# AutoFlow — Implementation Flow

How the system was built (phase order + decisions) and how it behaves at runtime
(end-to-end traces through the actual files). The last section is a **"where do I change
X?" cheat-sheet** for making edits quickly. For the static structure, see
[ARCHITECTURE.md](ARCHITECTURE.md).

---

## Part 1 — Build order (phases 1 → 13)

Each phase was completed and verified before the next. Phases build on each other in
this dependency order:

```
1 scaffold ─▶ 2 auth ─▶ 3 workspaces ─┬─▶ 4 files ──▶ 5 git
                                       ├─▶ 6 secrets/variables
                                       └─▶ 7 workflow engine ─▶ 8 scheduler
                                                              └▶ 9 executor ─▶ 10 logs
                                       11 notifications, 12 dashboard (cross-cutting)
                                       13 polish + docs
```

| Phase | Added | Key files | Key decisions |
|------:|-------|-----------|---------------|
| **1** | Runnable scaffold: FastAPI app, Celery, Postgres, Redis, React, docker-compose | `app/main.py`, `core/config.py`, `core/database.py`, `core/exceptions.py`, `models/base.py` | App factory pattern; two DB engines; `SECRET_KEY` required (≥32) at boot |
| **2** | Auth + users + RBAC primitives | `core/security.py`, `services/auth_service.py`, `api/deps.py`, `api/v1/auth.py`, `api/v1/users.py`, `models/user.py` | First user → admin; JWT access/refresh with `type`+`jti`; `get_current_user` dependency |
| **3** | Workspaces + membership | `models/workspace.py`, `services/workspace_service.py`, `repositories/workspace.py`, `api/v1/workspaces.py` | `WorkspaceContext` + `require_workspace_role` factory; owner auto-added as `owner`; 404 hides non-membership |
| **4** | File manager | `core/storage.py`, `services/file_service.py`, `api/v1/files.py` | `safe_join` blocks `../`; 1 MB cap; binary rejected; `.git` hidden |
| **5** | Git per workspace | `services/git_service.py`, `api/v1/git.py` | GitPython; default branch `main`; identity = AutoFlow bot |
| **6** | Secrets + variables | `core/crypto.py`, `models/secret.py`, `services/secret_service.py`, `api/v1/secrets.py`, `schemas/secret.py` | Fernet at rest; `SecretRead` omits `value` (write-only); `build_env` merges vars + decrypted secrets |
| **7** | Workflow engine | `workers/parser.py`, `models/workflow.py`, `services/workflow_service.py`, `api/v1/workflows.py`, `api/v1/webhooks.py` | YAML → `ParsedWorkflow`; validate on save (→422); `create_run` commits **before** enqueue |
| **8** | Scheduler | `workers/celery_app.py` (beat), `workers/tasks.py` (`dispatch_scheduled`), `workers/runner.py` | Beat ticks 60s; croniter window check; 55s dup-guard |
| **9** | Executor | `workers/executor.py`, `workers/runner.py`, `workers/tasks.py` (`run_workflow`) | `bash -eo pipefail -c`; minimal env; fail stops pipeline; cancellable between steps |
| **10** | Logging | `workers/executor.py` (`_run_step`), `models/workflow.py` (`StepRun.logs`) | Combined stdout/stderr; commit every ~10 lines for live tail |
| **11** | Notifications | `models/notification.py`, `services/notification_service.py`, `api/v1/notifications.py` | Emitted by executor `_notify`; unread count endpoint for the UI badge |
| **12** | Dashboard | `services/dashboard_service.py`, `api/v1/dashboard.py`, `schemas/dashboard.py` | Aggregates over the caller's workspaces; recent runs carry IDs for deep-linking |
| **13** | Polish + docs | `alembic/versions/0001_initial.py`, `README.md`, `docs/*` | Hand-written migration; `ruff` clean; integration suite; full docs |

The **entire React frontend** (`frontend/src/**`) was built after the backend was green,
mapping one page (or tab) to each backend feature.

---

## Part 2 — Runtime flows

These trace real requests through the code. File paths are relative to `backend/` or
`frontend/` as noted.

### 2.1 Register → login (first user becomes admin)

```
Frontend: Register.tsx submit
  → useAuth().register()                         (src/auth/AuthContext.tsx)
      → api.auth.register({...})  POST /api/v1/auth/register
      → api.auth.login(username, password)        (on success)

Backend: POST /api/v1/auth/register               (app/api/v1/auth.py)
  → AuthService.register(data)                     (app/services/auth_service.py)
      → UserRepository.any_exist()  — is this the first account?
      → check email/username conflicts → ConflictError(409) if taken
      → hash_password(...)                          (app/core/security.py)
      → if first account: is_superuser=True, role=admin
      → INSERT user
  ← UserRead (no password)

Backend: POST /api/v1/auth/login                   (OAuth2PasswordRequestForm)
  → AuthService.authenticate(login, password)      → verify_password
  → AuthService.issue_tokens(user)                 → create_access_token + create_refresh_token
  ← Token { access_token, refresh_token }

Frontend: tokenStore.set(tokens)                   (localStorage: af_access / af_refresh)
  → AuthContext stores the user → routes unlock
```

### 2.2 Create a workspace

```
Frontend: Workspaces.tsx "New workspace" modal → api.workspaces.create({name})
Backend: POST /api/v1/workspaces                   (app/api/v1/workspaces.py)
  → get_current_user dependency                    (app/api/deps.py)
  → WorkspaceService.create(data, user.id)         (app/services/workspace_service.py)
      → slugify + ensure unique slug
      → INSERT workspace (owner_id = user.id)
      → INSERT WorkspaceMember(user, role=owner)
      → ensure_workspace_dir(workspace.id)         (app/core/storage.py — makes the dir)
  ← WorkspaceRead { ..., role: "owner" }
Frontend: navigate to /workspaces/{id}
```

### 2.3 Edit a file, then commit it

```
Open file:  GET  /files/content?path=...   → FileService.read_file (safe_join, 1MB cap)
Save file:  PUT  /files/content?path=...   → FileService.write_file
            (requires role ≥ member via require_workspace_role(MEMBER))
Git panel:
  POST /git/init    → GitService.init()      (repo + main branch + bot identity)
  POST /git/commit  → GitService.commit(msg, add_all=True)
  GET  /git/log     → GitService.log()       (renders recent commits in the panel)
```
All Git endpoints live in `app/api/v1/git.py` → `app/services/git_service.py` (GitPython).

### 2.4 Create and run a workflow manually — the full path

This is the most important flow; it spans the API and the worker process.

```
── API process (async) ──────────────────────────────────────────────────────────────
Frontend: WorkflowsTab.tsx "New workflow" → api.workflows.create(ws, {name, definition})
  POST /workspaces/{ws}/workflows                  (app/api/v1/workflows.py)
    → WorkflowService.create(...)                  (app/services/workflow_service.py)
        → _validate(definition) → parse_workflow    (app/workers/parser.py) → 422 if bad
        → generate slug, webhook_token
        → INSERT workflow
Frontend: WorkflowDetail.tsx — edit YAML → Save (PATCH) → "Run now"
  POST /workspaces/{ws}/workflows/{id}/trigger
    → WorkflowService.create_run(wf, trigger="manual", user_id)
        1. parse_workflow(definition)              (fail fast before promising a run)
        2. RunRepository.next_run_number(wf.id)
        3. INSERT WorkflowRun (status=queued)
        4. INSERT one StepRun per parsed step (status=pending)
        5. db.commit()        ◀── COMMIT BEFORE ENQUEUE (durability before dispatch)
        6. run_workflow.delay(run_id)  → Redis broker, store celery_task_id
    ← 202 WorkflowRun { status: "queued" }
  Frontend navigates to the run page (RunDetail.tsx) and starts polling.

── Worker process (sync) ─────────────────────────────────────────────────────────────
Celery picks up run_workflow(run_id)               (app/workers/tasks.py)
  → opens SessionLocal()  (sync engine)
  → execute_run(db, run_id)                         (app/workers/executor.py)
      • mark run RUNNING + started_at
      • _build_env():  minimal base (PATH/HOME/LANG/CI/AUTOFLOW)
                       + workspace variables
                       + decrypted workspace secrets   (SecretService.build_env)
                       + workflow-level env             (later layers win)
      • for each StepRun (by step_index):
          - _run_step(): bash -eo pipefail -c <command> in the workspace dir
                         stream combined stdout+stderr into StepRun.logs
                         commit every ~10 lines        ← enables live tail
                         exit code recorded; 1800s timeout → exit 124
          - on non-zero exit: StepRun=failed, then SKIP remaining steps
                              (unless the step had continue_on_error: true)
          - check for cancellation between steps
      • final run status: success / failed / cancelled  + finished_at
      • _notify(): INSERT a Notification for the triggerer / owner
```

### 2.5 Live log streaming (how the run page tails output)

```
RunDetail.tsx mounts → fetchRun()                  (src/pages/RunDetail.tsx)
  → api.workflows.run(ws, wf, runId)  GET .../runs/{runId}   (returns run + steps + logs)
  → if status ∈ {queued, running}: setTimeout(fetchRun, 2000)   (poll every 2s)
  → re-render step cards; failed/running steps auto-expand their <pre> logs
Because the worker commits StepRun.logs every ~10 lines, each poll shows fresh output.
Polling stops automatically once the run reaches a terminal status.
```

### 2.6 Scheduled trigger (cron)

```
scheduler (Celery Beat) fires schedule.dispatch every 60s   (app/workers/celery_app.py)
  → dispatch_scheduled()                            (app/workers/tasks.py)
      → query enabled workflows with trigger_type=schedule and a valid cron
      → for each: croniter — did the previous fire fall in the last 60s window?
                  AND not recently_dispatched(wf)   (55s dup-guard, app/workers/runner.py)
      → if yes: create_run_sync(...) + run_workflow.delay(...)   (same path as §2.4 worker)
```

### 2.7 Webhook trigger (no auth)

```
External caller: POST /api/v1/webhooks/{token}      (app/api/v1/webhooks.py — PUBLIC)
  → WorkflowRepository.get_by_webhook(token) → 404 if unknown
  → assert workflow.trigger_type == webhook → 409 otherwise
  → WorkflowService.create_run(wf, trigger="webhook", user_id=None)   (→ §2.4 path)
  ← 202 { run_id, run_number, status }
Regenerating the token (POST .../regenerate-webhook) revokes the old URL.
```

### 2.8 Token refresh (frontend, transparent)

```
Any api.* call → request() attaches "Authorization: Bearer <af_access>"  (src/lib/api.ts)
  → if response is 401 AND we haven't retried:
       tryRefresh(): POST /api/v1/auth/refresh { refresh_token: af_refresh }
         → on success: tokenStore.set(newTokens); retry the original request ONCE
         → on failure: tokenStore.clear()  (user is bounced to /login by <Protected>)
Concurrent 401s share a single in-flight refresh promise (no refresh stampede).
```

---

## Part 3 — "Where do I change X?" cheat-sheet

| I want to…                                   | Edit this                                                                                          |
|----------------------------------------------|---------------------------------------------------------------------------------------------------|
| Add a new API endpoint                       | Add a route in the matching `backend/app/api/v1/*.py`; it's auto-mounted via `app/api/router.py`   |
| Add a field to a table                       | `backend/app/models/<entity>.py` → add an Alembic migration → expose it in `app/schemas/<entity>.py` |
| Change request/response shape                | `backend/app/schemas/<feature>.py` (and the TS mirror in `frontend/src/lib/types.ts`)             |
| Change business rules                        | `backend/app/services/<feature>_service.py`                                                        |
| Change a DB query                            | `backend/app/repositories/<feature>.py`                                                            |
| Change who can do what (RBAC)                | `backend/app/api/deps.py` (`require_workspace_role`, `role_rank`) + the dependency on the route    |
| Change workflow execution semantics          | `backend/app/workers/executor.py` (`execute_run`, `_run_step`, `_build_env`)                       |
| Add a new step option (e.g. `working_dir`)   | `backend/app/workers/parser.py` (`ParsedStep` + parsing) **and** `executor.py` (`_run_step`)       |
| Change the YAML schema / validation          | `backend/app/workers/parser.py` (`parse_workflow`, `validate_definition`)                          |
| Change the schedule tick or dup-guard window | `backend/app/workers/celery_app.py` (beat interval) + `runner.py` (`recently_dispatched`)          |
| Change how secrets are encrypted             | `backend/app/core/crypto.py`                                                                       |
| Change token lifetimes / signing             | `backend/app/core/config.py` (TTLs) + `core/security.py`                                           |
| Change the first-user-is-admin behavior      | `backend/app/services/auth_service.py` (`register`)                                                |
| Add/adjust a config setting                  | `backend/app/core/config.py` (`Settings`) + `.env.example`                                         |
| Tweak the schema migration                   | `backend/alembic/versions/0001_initial.py`                                                         |
| Add a UI page or route                       | `frontend/src/pages/…` + register it in `frontend/src/App.tsx`                                     |
| Add a workspace tab                          | `frontend/src/pages/workspace/…Tab.tsx` + wire it in `WorkspaceDetail.tsx`                         |
| Call a new endpoint from the UI              | Add a typed method in `frontend/src/lib/api.ts`                                                    |
| Restyle shared components                    | `frontend/src/components/ui.tsx` (Button/Input/Card/Modal/StatusPill/…)                            |
| Change nav / notification polling            | `frontend/src/components/Layout.tsx`                                                               |
| Change the live-tail poll interval           | `frontend/src/pages/RunDetail.tsx` (the `setTimeout(fetchRun, 2000)`)                              |

### Tests

The integration suite lives in `backend/tests/` (`conftest.py` sets up a SQLite-backed
harness with a Celery stub; `test_integration.py` drives the flows above). Run it with:

```bash
cd backend && SECRET_KEY="test-secret-key-test-secret-key-0123456789" python -m pytest tests/ -q
```

Add new tests there; the harness already provides an authenticated `client` fixture and
a synchronous `db_sync` session for driving the executor directly.
