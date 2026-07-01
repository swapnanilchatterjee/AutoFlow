# AutoFlow — Architecture

This document explains how AutoFlow is put together: the services, the backend layers,
the request and execution lifecycles, the data model, and the rationale behind the
non-obvious decisions. Pair it with [IMPLEMENTATION_FLOW.md](IMPLEMENTATION_FLOW.md)
(step-by-step runtime traces) and the [README](../README.md) (feature tour + YAML
format).

---

## 1. System overview

AutoFlow is six cooperating services. The API is the brain; Celery (worker + beat) is
the muscle; Postgres is the source of truth; Redis is the message bus.

```
                          ┌─────────────────────────┐
                          │      Frontend (SPA)      │   React + Vite + Tailwind
                          │   pages → api.ts client  │   talks REST to the API
                          └───────────┬─────────────┘
                                      │ HTTP /api/v1/*  (JWT bearer)
                                      ▼
                          ┌─────────────────────────┐
                          │      API  (FastAPI)      │   async, uvicorn
            ┌─────────────│  routers → services →    │─────────────┐
            │             │  repositories → models   │             │
            │ enqueue     └───────────┬─────────────┘             │ read/write (async)
            ▼  run job                │ commit run rows            ▼
   ┌──────────────┐                   │                  ┌──────────────────┐
   │    Redis     │                   │                  │    PostgreSQL    │
   │ broker (db1) │                   │                  │  9 tables, ORM   │
   │ result (db2) │                   │                  └────────▲─────────┘
   └──────┬───────┘                   │                           │ read/write (sync)
          │ consume                   │                           │
          ▼                           ▼                           │
   ┌──────────────┐         ┌──────────────────┐         ┌────────┴─────────┐
   │   Worker     │────────▶│  Workflow engine │         │    Scheduler     │
   │  (Celery)    │         │ parser→executor  │◀────────│  (Celery Beat)   │
   │  runs steps  │         │  bash per step   │ enqueue │  cron, every 60s │
   └──────────────┘         └──────────────────┘         └──────────────────┘
```

| Service     | Process                                            | Talks to            |
|-------------|----------------------------------------------------|---------------------|
| `frontend`  | Vite dev server (prod: static build)               | API over HTTP       |
| `api`       | `uvicorn app.main:app`                             | Postgres, Redis     |
| `worker`    | `celery -A app.workers.celery_app:celery_app worker` | Postgres, Redis   |
| `scheduler` | `celery -A app.workers.celery_app:celery_app beat` | Redis (enqueues)    |
| `postgres`  | PostgreSQL 16                                       | —                   |
| `redis`     | Redis 7 (broker db1, results db2)                  | —                   |

---

## 2. Backend layered architecture

The backend follows a strict, one-directional dependency flow. Each layer only knows
about the layer directly beneath it. This keeps business logic out of HTTP handlers and
SQL out of business logic.

```
   HTTP request
        │
        ▼
┌──────────────────┐   app/api/v1/*.py        — translate HTTP ↔ Python, status codes,
│   Router         │                            response_model. NO business logic.
└────────┬─────────┘
         │ calls
         ▼
┌──────────────────┐   app/api/deps.py        — dependency injection: get_current_user,
│   Dependencies   │                            get_workspace_ctx, require_workspace_role.
└────────┬─────────┘                            Authn/authz happens HERE, declaratively.
         │
         ▼
┌──────────────────┐   app/services/*.py      — the actual rules: "first user is admin",
│   Service        │                            "owner can't be demoted", run creation,
└────────┬─────────┘                            secret encryption, env assembly.
         │ uses
         ▼
┌──────────────────┐   app/repositories/*.py  — data access only: get_by_slug, next_run
│   Repository     │                            _number, list_for_user. Returns models.
└────────┬─────────┘
         │ queries
         ▼
┌──────────────────┐   app/models/*.py        — SQLAlchemy ORM tables + relationships.
│   Model (ORM)    │
└──────────────────┘

   Pydantic schemas (app/schemas/*.py) sit alongside, validating everything that
   crosses the router boundary in either direction.
```

### Directory map (annotated)

```
backend/app/
├── main.py              create_app() factory, lifespan, CORS, exception handlers,
│                        mounts api_router. ASGI entry = app.main:app
├── core/                cross-cutting infrastructure (no business logic)
│   ├── config.py        Settings (pydantic-settings); SECRET_KEY (≥32), DB/Redis URLs,
│   │                    token TTLs, CORS, API_V1_PREFIX, WORKSPACES_ROOT
│   ├── database.py      async_engine + get_db (API) | sync_engine + get_sync_db (worker)
│   ├── security.py      bcrypt hash/verify; PyJWT create/decode access & refresh tokens
│   ├── crypto.py        Fernet encrypt/decrypt; key derived from SECRET_KEY
│   ├── storage.py       workspace_dir, ensure_workspace_dir, safe_join (blocks ../)
│   ├── enums.py         UserRole, WorkspaceRole, TriggerType, RunStatus, StepStatus
│   └── exceptions.py    AppException + NotFound/Conflict/Unauthorized/Forbidden + handler
├── api/
│   ├── router.py        aggregates all v1 routers under /api/v1
│   ├── deps.py          auth + workspace-context + RBAC dependencies
│   └── v1/              one file per feature (auth, users, workspaces, files, git,
│                        secrets, workflows, webhooks, notifications, dashboard, health)
├── models/             9 ORM tables (see §6)
├── schemas/            Pydantic request/response models, one file per feature
├── repositories/       async data-access classes (BaseRepository + per-entity)
├── services/           business logic, one file per feature
└── workers/
    ├── celery_app.py    Celery app; beat_schedule (dispatch every 60s); task includes
    ├── tasks.py         health.ping | workflow.run | schedule.dispatch
    ├── parser.py        YAML → ParsedWorkflow/ParsedStep; validate_definition
    ├── executor.py      execute_run(): the heart — runs steps in bash, writes logs
    └── runner.py        create_run_sync, next_run_number, recently_dispatched guard
```

### Why two database engines

`app/core/database.py` builds **two** engines on purpose:

- **Async** (`asyncpg`) → used by the API via `get_db`. FastAPI is async; an async
  driver avoids blocking the event loop under concurrent requests.
- **Sync** (`psycopg2`) → used by Celery tasks and Alembic via `get_sync_db` /
  `SessionLocal`. Celery tasks are plain synchronous functions; mixing an event loop
  into a worker process is needless complexity.

Both share the same models and the same database. The split is purely about the driver
that fits each runtime. UUID primary keys use SQLAlchemy 2.0's dialect-agnostic `Uuid`
type, which renders as native `UUID` on Postgres (and `CHAR(32)` elsewhere, which is
what lets the test suite run on SQLite without touching the models).

---

## 3. Request lifecycle (an authenticated API call)

Tracing `PUT /api/v1/workspaces/{id}/files/content?path=src/app.py`:

```
1. uvicorn receives the request, hands it to the FastAPI app (app/main.py).
2. CORS middleware + the route match select files.write_file (app/api/v1/files.py).
3. Dependencies resolve, in order:
     get_db                → opens an AsyncSession (commits on success, rolls back on error)
     get_current_user      → reads "Authorization: Bearer", decode_token(access),
                             loads the User, checks is_active            (app/api/deps.py)
     require_workspace_role(MEMBER)
                           → loads the Workspace + the caller's WorkspaceMember,
                             builds a WorkspaceContext, asserts role ≥ member
                             (superusers are treated as implicit owners;
                              non-members get 404 to hide existence)
4. The router body runs: FileService(ctx.workspace.id).write_file(path, content).
5. FileService resolves the path with safe_join (rejects traversal), writes the file.
6. The handler returns a FileNode; FastAPI serializes it via the response_model.
7. get_db commits the (here, no-op DB) transaction; the JSON response goes back.
On any AppException raised in steps 3–6, register_exception_handlers turns it into a
clean JSON error with the right status code.
```

The shape is identical for every endpoint: **dependencies do authn/authz, the router
delegates to a service, the service does the work, a schema shapes the output.**

---

## 4. Workflow execution architecture

This is the part that makes AutoFlow more than a CRUD app. Execution is split across the
API (which only *records intent*) and the worker (which *does the work*), connected by
Redis.

```
API side (async)                         Worker side (sync, separate process)
─────────────────                        ────────────────────────────────────
WorkflowService.create_run()
  1. parse_workflow(definition)  ──┐     (validate before we promise to run it)
  2. RunRepository.next_run_number │
  3. INSERT WorkflowRun (queued)   │
  4. INSERT one StepRun per step   │
  5. db.commit()  ◀────────────────┘  ← COMMIT BEFORE enqueue, so the worker can never
  6. run_workflow.delay(run_id)         look up a run that isn't there yet (race fix)
        │ (Redis broker)
        ▼
                                    run_workflow(run_id)            (app/workers/tasks.py)
                                      opens SessionLocal()
                                      → execute_run(db, run_id)     (app/workers/executor.py)
                                          mark run RUNNING + started_at
                                          _build_env(): minimal base
                                              + variables + decrypted secrets
                                              + workflow env  (later wins)
                                          for each StepRun (by index):
                                            _run_step(): bash -eo pipefail -c <cmd>
                                              in the workspace dir, stream combined
                                              stdout/stderr into StepRun.logs,
                                              commit every 10 lines (live tail)
                                            on non-zero exit: mark FAILED, then SKIP
                                              the rest (unless continue_on_error)
                                            check cancellation between steps
                                          final run status SUCCESS / FAILED / CANCELLED
                                          + finished_at
                                          _notify(): INSERT a Notification for the
                                              triggerer / owner
```

Key properties:

- **Isolation of intent vs. execution.** The API stays fast and never blocks on a job;
  the worker owns the long-running work. They communicate only through the DB + Redis.
- **The commit-before-enqueue ordering** in `create_run` is deliberate — Celery could
  start the task on another machine in milliseconds, so the rows must be durable first.
- **Minimal environment by design.** `_build_env` does **not** inherit the worker's full
  `os.environ`; it starts from a small allow-list and layers workspace vars, decrypted
  secrets, and workflow/step `env`. This avoids leaking host state into user jobs.
- **Live logs** come from committing `StepRun.logs` every ~10 lines while the step runs;
  the run page polls and re-renders (see §7).

### Scheduler

`scheduler` is Celery Beat. Its `beat_schedule` fires `schedule.dispatch` every 60s
(`app/workers/celery_app.py`). `dispatch_scheduled` (`tasks.py`) queries enabled
workflows whose `trigger_type=schedule` with a valid cron, and for each checks (via
`croniter`) whether the previous fire time falls inside the last 60-second window **and**
that it wasn't `recently_dispatched` (a 55s dup-guard in `runner.py`). Matching workflows
get a run created and enqueued exactly like a manual trigger.

---

## 5. Security architecture

| Concern             | Mechanism                                                                 | Where                      |
|---------------------|---------------------------------------------------------------------------|----------------------------|
| Password storage    | bcrypt (72-byte input cap handled)                                        | `core/security.py`         |
| Sessions            | JWT HS256: short-lived access + longer refresh, each tagged with a `type` & `jti` | `core/security.py`, `auth_service` |
| First-user bootstrap| First successful registration → `is_superuser=True`, role `admin`         | `services/auth_service.py` |
| Authorization       | Per-workspace roles `viewer<member<maintainer<owner`, enforced by a dependency factory | `api/deps.py` |
| Existence hiding    | Non-members receive 404 (not 403) for a workspace                          | `api/deps.py`              |
| Secret confidentiality | Fernet encryption at rest; values are **write-only** (never serialized) | `core/crypto.py`, `schemas/secret.py` (`SecretRead` has no `value`) |
| Path traversal      | `safe_join` resolves and confirms the target stays under the workspace root | `core/storage.py`        |
| Webhook auth        | The unguessable token in the URL **is** the credential; regenerate to revoke | `api/v1/webhooks.py`     |

**The `SECRET_KEY` is load-bearing twice:** it signs JWTs *and* derives the Fernet key
for secrets. Rotating it invalidates both existing sessions (users re-login) and all
stored secrets (they must be re-entered). This is documented prominently in SETUP.

---

## 6. Data model

Nine tables. Relationships (──< means one-to-many):

```
User ──< WorkspaceMember >── Workspace          (membership = many-to-many + role)
User ──< Notification                            Workspace.owner_id → User
Workspace ──< Workflow ──< WorkflowRun ──< StepRun
Workspace ──< Secret                             (encrypted value)
Workspace ──< Variable                           (plaintext value)
Workspace ──< WorkflowRun                        (also linked directly for fast queries)
```

| Table               | Purpose                          | Notable columns                                                                 |
|---------------------|----------------------------------|---------------------------------------------------------------------------------|
| `users`             | Accounts                         | `email`/`username` (unique), `hashed_password`, `is_superuser`, `role`          |
| `workspaces`        | Projects                         | `slug` (unique), `owner_id`                                                      |
| `workspace_members` | Membership + role                | `(workspace_id, user_id)` unique, `role`                                        |
| `secrets`           | Encrypted secrets                | `(workspace_id, key)` unique, `value_encrypted`                                  |
| `variables`         | Plaintext config                 | `(workspace_id, key)` unique, `value`                                            |
| `workflows`         | Automations                      | `(workspace_id, slug)` unique, `definition` (YAML), `trigger_type`, `schedule_cron`, `webhook_token` (unique), `enabled` |
| `workflow_runs`     | Run instances                    | `run_number`, `status`, `trigger`, `started_at`/`finished_at`, `celery_task_id` |
| `step_runs`         | Per-step results                 | `step_index`, `status`, `command`, `exit_code`, `logs`                          |
| `notifications`     | In-app notifications             | `user_id` (idx), `is_read` (idx), `link`, `type`                                |

All enums are stored as `VARCHAR`. Timestamps `started_at`/`finished_at` on runs/steps
are ISO strings (`STRING(40)`) for portability. The schema is created by
`alembic/versions/0001_initial.py` (hand-written; native `UUID`, FKs, unique constraints,
indexes) and mirrors the models exactly.

---

## 7. Frontend architecture

A single-page React app. No global state library — React Router for navigation, one
auth context, and a typed API client.

```
src/
├── main.tsx              wraps <App/> in <BrowserRouter> + <AuthProvider>
├── App.tsx               routes; <Protected> guards everything behind Layout
├── lib/
│   ├── api.ts            tokenStore (localStorage) + request() wrapper + typed `api.*`.
│   │                     request() auto-refreshes on 401 ONCE, then retries; on failure
│   │                     clears tokens. login posts x-www-form-urlencoded (OAuth2 form).
│   └── types.ts          TS mirrors of every API shape
├── auth/AuthContext.tsx  useAuth(): user, loading, login/register/logout/refreshUser
├── components/
│   ├── Layout.tsx        sidebar nav + unread-notification badge (polls 20s) + outlet
│   └── ui.tsx            Button/Input/Card/Modal/StatusPill/EmptyState/Spinner/fmtDate
└── pages/
    ├── Login, Register                  auth-card forms
    ├── Dashboard                        KPIs + runs-by-status + recent runs
    ├── Workspaces                       list + create modal
    ├── WorkspaceDetail                  tab shell; computes canWrite/canManage/isOwner
    │   └── workspace/                   FilesTab (browser+editor+git), WorkflowsTab,
    │                                    SecretsTab, MembersTab, SettingsTab
    ├── WorkflowDetail                   YAML editor, trigger config, webhook, runs list
    ├── RunDetail                        per-step collapsible logs; POLLS every 2s while
    │                                    the run is queued/running (live tail)
    └── Notifications                    list + mark-all-read
```

**Conventions baked in:** primary action buttons are right-aligned everywhere;
write actions are hidden/disabled based on the caller's workspace role (derived from
`workspace.role` returned by the API); the dev server proxies `/api` → `:8000`
(`vite.config.ts`) so there's no CORS friction in development.

---

## 8. Design decisions & rationale (quick reference)

| Decision                                               | Why                                                                   |
|--------------------------------------------------------|-----------------------------------------------------------------------|
| Router → service → repository → model                  | Testable business logic; HTTP and SQL never leak into each other      |
| Async engine for API, sync engine for worker           | Right driver per runtime; no event loop inside Celery                 |
| Commit run rows **before** `.delay()`                  | Worker may start instantly elsewhere — rows must be durable first     |
| Minimal executor env (not full `os.environ`)           | Don't leak host state/credentials into user shell jobs                |
| Secrets write-only + Fernet at rest                    | A leaked DB or API response never exposes secret values               |
| 404 (not 403) for non-members                          | Don't reveal which workspaces exist to outsiders                      |
| Dialect-agnostic `Uuid`                                | Native UUID on Postgres; enables hermetic SQLite tests                |
| First user becomes admin                               | Zero-config bootstrap for a self-hosted single-tenant install         |
| Token in webhook URL as the credential                 | Lets external systems trigger runs without managing API keys          |
| Per-step `logs` committed every ~10 lines              | Cheap live-tail without a streaming transport                         |

---

## See also

- [IMPLEMENTATION_FLOW.md](IMPLEMENTATION_FLOW.md) — phase-by-phase build order and
  end-to-end runtime traces, plus a "where do I change X?" cheat-sheet.
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) — high-level overview and status.
- [SETUP.md](SETUP.md) — running it, locally or via Docker.
- [README.md](../README.md) — feature tour and the workflow YAML format.
