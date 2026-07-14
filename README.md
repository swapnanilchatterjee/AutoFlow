# AutoFlow

A **100% free, self-hosted automation platform** — GitHub-style *workspaces* with
GitHub Actions-style *workflows*, built to run local automation projects (scripts,
SQL jobs, reports, notifications) instead of hosting code repositories.

Everything runs on open-source software. No SaaS, no cloud lock-in. `docker compose up`
and you have the whole stack on your machine.

> **Status:** all phases complete, plus messaging integrations and a light-theme UI.
> The backend exposes 99 REST endpoints, a YAML
> workflow engine, a cron scheduler, webhook triggers, encrypted secrets, an embedded
> Git per workspace, and a React SPA covering every feature. `ruff` clean, integration
> test suite green.

## Documentation

- **[docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)** — deliver reports via Gmail, Telegram & WhatsApp
- **[docs/CLICKHOUSE_PRODUCTION_SETUP.md](docs/CLICKHOUSE_PRODUCTION_SETUP.md)** — production plan for ClickHouse analytical log database migration
- **[docs/POSTMAN_COLLECTION.md](docs/POSTMAN_COLLECTION.md)** — complete Postman collection API reference

- **[docs/PROJECT_SUMMARY.md](docs/PROJECT_SUMMARY.md)** — high-level overview, feature
  set, stack, and status.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — services, the layered backend,
  request/execution lifecycles, the data model, and design rationale.
- **[docs/IMPLEMENTATION_FLOW.md](docs/IMPLEMENTATION_FLOW.md)** — how it was built phase
  by phase, end-to-end runtime traces, and a "where do I change X?" cheat-sheet.
- **[docs/SETUP.md](docs/SETUP.md)** — running it (Docker or local) + troubleshooting.

---

## What it does

Each **workspace** is an isolated project — like a GitHub repo — with its own files,
scripts, secrets, variables, workflows, schedules, run logs, and Git history.
Workspaces never touch each other's data. A **workflow engine** (YAML, à la GitHub
Actions) runs a sequence of shell steps on a schedule, on a webhook, or on demand,
executed by a **Celery worker** and fired by a **Celery Beat scheduler**, with full
run history and live-streamed per-step logs.

**Feature tour**

- **Auth & RBAC** — JWT access/refresh tokens; the **first account to register becomes
  the platform admin** (superuser), or you can use a secure `ADMIN_REGISTRATION_TOKEN` if defined in the environment. Per-workspace roles: `viewer` < `member` <
  `maintainer` < `owner`.
- **Workspaces** — create projects, invite members, assign roles, delete.
- **File manager** — browse/create/edit/rename/delete files in a workspace tree, with
  path-traversal protection. Edit files straight from the UI.
- **Git** — every workspace is a real Git repo (via GitPython): init, stage, commit,
  view log and branches, create/checkout branches.
- **Secrets & variables** — secrets are Fernet-**encrypted at rest** and write-only
  (values are never returned by the API); variables are plain config. Both are injected
  as environment variables into every workflow run.
- **Workflow engine** — GitHub-Actions-style YAML: top-level `env`, a list of `steps`,
  each running a shell command, with `continue_on_error` and per-step `env`.
- **Scheduler** — cron-scheduled workflows fire automatically (evaluated every minute).
- **Webhooks** — webhook-triggered workflows expose an unguessable public URL.
- **Logs** — detailed execution and delivery history (capturing built-in integration channels like Gmail/Telegram and all generic shell steps under a `"shell"` channel); tracks status, exit codes, recipient details, and message outputs. Fully searchable, filterable by date range, and exportable to CSV.
- **Notifications & Alerts** — in-app alerts on run completion, plus immediate admin email alerts on workflow failure.
- **Dashboard** — workspace summary statistics and an interactive timeline line graph displaying 3 distinct paths (Delivered, Executing, Failed) with scale granularities from seconds up to months.

---

## The workflow format

A workflow is YAML stored on the workflow itself. It is intentionally close to GitHub
Actions, minus the cloud:

```yaml
name: Nightly report            # optional label
env:                            # optional, applies to every step
  REPORT_DIR: ./reports
steps:                          # required, runs top-to-bottom
  - name: Prepare               # optional step label
    run: mkdir -p "$REPORT_DIR"

  - name: Build report          # multi-line commands with the YAML | block
    run: |
      echo "generating..."
      date > "$REPORT_DIR/stamp.txt"
      echo "rows: $(wc -l < data.csv)" >> "$REPORT_DIR/stamp.txt"

  - name: Upload (best effort)
    run: ./upload.sh "$REPORT_DIR"
    continue_on_error: true     # a failure here won't fail the run
    env:                        # per-step env, merged over the top-level env
      TARGET: s3://backups
```

**Action steps — deliver reports (Gmail / Telegram / WhatsApp)**

A step is either a shell step (`run:`) or an *action step* (`uses:`) that delivers a
message through a channel you configured under a workspace's **Integrations** tab. The
`with:` block is uniform across channels — each channel uses what it supports:

```yaml
steps:
  - name: Build report
    run: ./make_report.sh          # writes reports/daily.pdf

  - name: Email the report
    uses: gmail                    # gmail | telegram | whatsapp
    with:
      to: [alice@example.com, bob@example.com]
      subject: Daily report
      body: "Attached is today's report."
      format: text                 # text | html | markdown
      attachments: [reports/daily.pdf]

  - name: Ping the team channel
    uses: telegram
    with:
      to: "@ops_reports"
      body: "✅ Daily report sent."
```

- `to` accepts one recipient or a list; `${VAR}` in `to`/`subject`/`body` is substituted
  from the run environment.
- `attachments` are workspace-relative file paths (25 MB total cap), so earlier steps can
  generate a report and a later step can attach it.
- Add a channel named `connection:` in `with:` to pick a specific connection when a
  workspace has more than one of the same type.
- Credentials live in encrypted **connections** (never in the YAML). Action-step logs
  record delivery metadata (recipients, attachment names, provider ids) but **not** the
  message body, so substituted secrets never leak into logs.
- See **[docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)** for per-channel credential setup.

**Execution semantics**

- Each step runs as `bash -eo pipefail -c <command>` in the workspace directory, so a
  failing command (non-zero exit) stops that step.
- Steps run sequentially. If a step fails, the remaining steps are **skipped** — unless
  the failed step had `continue_on_error: true`, in which case execution continues.
- The run is **`success`** only if no step failed; otherwise **`failed`**. A run can be
  **`cancelled`** from the UI/API while queued or running.
- The environment for every step is: a minimal base (`PATH`, `HOME`, `LANG`, `CI=true`,
  `AUTOFLOW=true`) **+** workspace variables **+** decrypted workspace secrets **+**
  the workflow's `env` **+** the step's `env` (later layers win). The full host
  environment is **not** inherited, by design.
- Long output is fine — logs stream to the database and tail live in the UI. Steps have
  a 30-minute wall-clock timeout (exit 124).

**Triggers** — a workflow has exactly one trigger type:

- `manual` — run on demand ("Run now" / `POST .../trigger`).
- `schedule` — give a 5-field cron expression (`schedule_cron`, e.g. `0 * * * *`); the
  scheduler evaluates enabled scheduled workflows every minute.
- `webhook` — AutoFlow generates a token and a public URL
  `POST /api/v1/webhooks/{token}` that triggers the run with no auth (the token is the
  secret). Regenerate the token any time to revoke the old URL.

---

## Architecture

```
                          ┌─────────────────────────┐
                          │      Frontend (SPA)      │
                          │  React + Vite + Tailwind │
                          └───────────┬─────────────┘
                                      │ HTTP / REST
                                      ▼
                          ┌─────────────────────────┐
                          │      API  (FastAPI)      │
            ┌─────────────│  routers → services →    │─────────────┐
            │             │  repositories → models   │             │
            │ enqueue     └───────────┬─────────────┘             │ persist
            ▼                         │                            ▼
   ┌──────────────┐                   │                  ┌──────────────────┐
   │    Redis     │                   │                  │    PostgreSQL    │
   │ broker/result│                   │                  │   (SQLAlchemy)   │
   └──────┬───────┘                   │                  └────────▲─────────┘
          │ consume                   │                           │ write runs/logs
          ▼                           │                           │
   ┌──────────────┐         ┌─────────┴────────┐         ┌────────┴─────────┐
   │   Worker     │────────▶│  Workflow engine │         │    Scheduler     │
   │  (Celery)    │         │ parse → execute  │◀────────│  (Celery Beat)   │
   │  runs steps  │         │  steps in bash   │ enqueue │  cron, every 60s │
   └──────────────┘         └──────────────────┘         └──────────────────┘
```

**Services**

| Service     | Tech              | Responsibility                                         |
|-------------|-------------------|--------------------------------------------------------|
| `frontend`  | React + Vite + TS | UI: dashboard, file manager + editor, workflows, runs  |
| `api`       | FastAPI + uvicorn | REST API, auth, OpenAPI docs, business logic           |
| `worker`    | Celery            | Parses and executes workflow steps in `bash`           |
| `scheduler` | Celery Beat       | Fires cron/scheduled workflow triggers every minute    |
| `postgres`  | PostgreSQL 16     | Source of truth (workspaces, runs, secrets, history)   |
| `redis`     | Redis 7           | Job broker + result backend                            |

**Backend layering** (clean architecture): `api` (routers) → `services` (business
logic) → `repositories` (data access) → `models` (ORM). Pydantic schemas validate all
I/O; dependencies are injected via FastAPI's `Depends`.

**Two DB engines on purpose:** the API uses an **async** SQLAlchemy engine (`asyncpg`);
Celery workers and Alembic use a **sync** engine (`psycopg2`). Both are configured in
`app/core/database.py`. UUID primary keys use SQLAlchemy 2.0's dialect-agnostic
`Uuid` type, which renders as native `UUID` on Postgres.

---

## Tech stack

Python 3.12 · FastAPI · SQLAlchemy 2.0 · Alembic · Pydantic v2 · Celery · Redis ·
PostgreSQL 16 · PyJWT · bcrypt · cryptography (Fernet) · GitPython · croniter · PyYAML ·
React 18 · TypeScript · Vite · React Router · TailwindCSS · Docker Compose. All
open-source.

---

## Quick start

```bash
# 1. Configure environment
cp .env.example .env
# edit .env and set a real SECRET_KEY:  openssl rand -hex 32

# 2. Build & start everything
docker compose up -d --build

# 3. Apply database migrations (creates all tables)
docker compose exec api alembic upgrade head   # or: make migrate

# 4. Open it
#   Frontend : http://localhost:5173   ← register here; the FIRST user is admin
#   API docs : http://localhost:8000/docs
#   Health   : http://localhost:8000/api/v1/health
```

Then, in the UI: **register** (first account = admin) → **New workspace** →
**Workflows → New workflow** → edit the YAML → **Run now** → watch the logs stream on
the run page. Full instructions (including running without Docker) are in
**[docs/SETUP.md](docs/SETUP.md)**.

---

## Project structure

```
autoflow/
├── docker-compose.yml          # postgres, redis, api, worker, scheduler, frontend
├── .env.example                # Copy to .env and configure
├── Makefile                    # Dev shortcuts (make up / migrate / test / lint ...)
├── README.md
├── docs/
│   ├── ARCHITECTURE.md         # Components, layers, lifecycles, data model, decisions
│   ├── IMPLEMENTATION_FLOW.md  # Phase build order + runtime traces + "where to change X"
│   ├── PROJECT_SUMMARY.md      # High-level overview & status
│   └── SETUP.md                # Detailed setup & troubleshooting guide
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt        # Runtime deps
│   ├── pyproject.toml          # ruff / black / mypy / pytest config
│   ├── alembic.ini
│   ├── alembic/                # env.py + versions/0001_initial.py (all 11 tables)
│   ├── app/
│   │   ├── main.py             # FastAPI app factory + ASGI entry (app.main:app)
│   │   ├── core/               # config, database, security, crypto, storage, enums, exceptions
│   │   ├── api/                # router.py + deps.py + v1/ (11 feature routers)
│   │   ├── models/             # SQLAlchemy models (11 tables)
│   │   ├── schemas/            # Pydantic I/O models
│   │   ├── services/           # Business logic
│   │   ├── repositories/       # Data access
│   │   └── workers/            # celery_app, tasks, parser, executor, runner
│   └── tests/                  # pytest (conftest harness + integration suite)
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts          # Dev proxy /api -> api:8000
    ├── tailwind.config.js
    └── src/
        ├── lib/                # api.ts (typed client + token refresh), types.ts
        ├── auth/               # AuthContext
        ├── components/         # Layout, ui primitives
        └── pages/              # Login, Register, Dashboard, Workspaces,
                                #   WorkspaceDetail (+workspace/ tabs),
                                #   WorkflowDetail, RunDetail, Notifications
```

---

## Development roadmap

All phases complete; each was fully functional before the next.

| Phase | Scope                              | Status |
|-------|------------------------------------|--------|
| 1     | Project setup & architecture       | ✅ done |
| 2     | Authentication (JWT, RBAC)         | ✅ done |
| 3     | Workspace management               | ✅ done |
| 4     | File manager                       | ✅ done |
| 5     | Git integration                    | ✅ done |
| 6     | Secret manager (encrypted)         | ✅ done |
| 7     | Workflow engine (YAML)             | ✅ done |
| 8     | Scheduler (cron)                   | ✅ done |
| 9     | Worker execution                   | ✅ done |
| 10    | Logging (live per-step)            | ✅ done |
| 11    | Notifications                      | ✅ done |
| 12    | Dashboard                          | ✅ done |
| 13    | Polish & docs                      | ✅ done |

---

## Security notes

- **First user is admin.** The first successful registration becomes a superuser; lock
  down registration afterward if your instance is exposed.
- **Secrets are encrypted at rest** with Fernet, using a key derived from `SECRET_KEY`.
  **Rotating `SECRET_KEY` invalidates all existing secrets** (they can no longer be
  decrypted) — re-enter them after a rotation. Keep `SECRET_KEY` safe and stable.
- **Workflows run arbitrary shell commands** on the worker, in the workspace directory.
  Treat workspace write access (`member`+) as the ability to run code on the worker
  host. Run workers with least privilege; isolate the deployment.
- Secret **values are never returned** by the API — only metadata (key, description).

---

## Useful commands

```bash
make up            # start the stack (detached)
make logs          # tail all service logs
make migrate       # alembic upgrade head
make makemigration m="add a column"
make test          # run backend tests
make lint          # ruff + mypy
make fmt           # black + ruff --fix
make down          # stop & remove containers
```

---

## License

MIT — see [LICENSE](LICENSE).


