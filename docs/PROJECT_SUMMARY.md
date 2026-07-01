# AutoFlow — Project Summary

## What it is

**AutoFlow** is a 100% free, self-hosted automation platform — think *GitHub +
GitHub Actions*, but for running local automation projects (scripts, SQL jobs, reports,
notifications) instead of hosting source repositories. Every workspace is an isolated
project with its own files, Git history, secrets, and workflows; a YAML workflow engine
runs sequences of shell steps on a schedule, via webhook, or on demand, with full run
history and live-streamed logs. The entire stack runs on open-source software with one
command — no SaaS, no cloud lock-in.

## The problem it solves

Small teams and individuals constantly need to run recurring shell jobs — backups,
reports, ETL, health checks — but the options are either heavyweight CI platforms tied
to a code host, paid SaaS schedulers, or a pile of untracked cron entries on a box with
no history, no UI, no secrets management, and no access control. AutoFlow gives you a
self-hostable middle ground: a clean UI, per-project isolation, encrypted secrets,
role-based access, and a real run history — without sending anything to a third party.

## Feature set

- **Auth & RBAC** — JWT access/refresh tokens; first registrant becomes admin;
  per-workspace roles (`viewer` < `member` < `maintainer` < `owner`).
- **Workspaces** — isolated projects with members and roles.
- **File manager** — browse/create/edit/rename/delete with path-traversal protection.
- **Git** — a real Git repo per workspace (init, stage, commit, log, branches, checkout).
- **Secrets & variables** — Fernet-encrypted, write-only secrets + plaintext variables,
  both injected as env vars into runs.
- **Workflow engine** — GitHub-Actions-style YAML (`env` + `steps[].run` +
  `continue_on_error`), validated on save.
- **Scheduler** — cron-scheduled workflows, evaluated every minute.
- **Webhooks** — unguessable public trigger URLs.
- **Runs & logs** — per-step status, exit code, timing, and live-tailed output.
- **Notifications** — in-app, on run completion.
- **Dashboard** — counts, success rate, recent runs.

## Tech stack

| Layer       | Technologies                                                                    |
|-------------|---------------------------------------------------------------------------------|
| Backend     | Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2                       |
| Async jobs  | Celery (worker + beat), Redis (broker + result backend)                         |
| Database    | PostgreSQL 16                                                                    |
| Security    | PyJWT (HS256), bcrypt, cryptography (Fernet)                                     |
| Engine libs | PyYAML (parse), croniter (schedule), GitPython (Git)                             |
| Frontend    | React 18, TypeScript, Vite, React Router, TailwindCSS                           |
| Ops         | Docker Compose (6 services), Makefile                                            |

## Codebase at a glance

| Metric                | Count   |
|-----------------------|---------|
| Backend Python files  | 67 (~3,780 LOC) |
| Frontend TS/TSX files | 21 (~1,797 LOC) |
| REST API endpoints    | 45      |
| Database tables       | 9       |
| ORM model files       | 5       |
| Service classes       | 8       |
| Repository classes    | 5       |
| API routers           | 11      |
| Test suite            | 6 tests, all green |

## Status & verification

**Complete — all 13 phases shipped and verified.**

- **Integration suite (6/6 pytest, SQLite-backed, hermetic)** exercises the real stack:
  first-user-admin + RBAC (incl. 403/404 paths), password verification, JWT round-trip,
  invalid-YAML rejection (422), file write round-trip, Git init + commit, and a full
  workflow run through the **synchronous executor** — env/variable/secret injection,
  artifact written to the workspace, fail-stops-pipeline + step skipping, failure
  notification, and dashboard aggregation.
- **`ruff` clean** across the backend; app imports with **45 routes** registered.
- **Frontend builds clean** (`tsc && vite build`): 51 modules, ~65 KB gzipped JS.

## Repository layout

```
autoflow/
├── README.md                 feature tour + workflow YAML format
├── docker-compose.yml        6 services
├── Makefile                  dev shortcuts
├── docs/
│   ├── ARCHITECTURE.md       components, layers, lifecycles, data model, decisions
│   ├── IMPLEMENTATION_FLOW.md phase build order + runtime traces + "where to change X"
│   ├── PROJECT_SUMMARY.md     this file
│   └── SETUP.md              run it (Docker or local) + troubleshooting
├── backend/                  FastAPI app, Celery workers, Alembic migration, tests
│   └── app/{core,api,models,schemas,services,repositories,workers}
└── frontend/                 React SPA
    └── src/{lib,auth,components,pages}
```

## Running it (TL;DR)

```bash
cp .env.example .env                              # set SECRET_KEY: openssl rand -hex 32
docker compose up -d --build
docker compose exec api alembic upgrade head      # create all tables
# → http://localhost:5173  (register; the FIRST user becomes admin)
```

Then: **New workspace → Workflows → New workflow → edit YAML → Run now → watch logs
stream.** Full instructions in [SETUP.md](SETUP.md).

## Security highlights

- **First registered user is admin** — restrict registration once your instance is
  exposed.
- **Secrets are encrypted at rest** (Fernet) and never returned by the API.
- **`SECRET_KEY` signs JWTs *and* derives the secrets key** — rotating it invalidates
  sessions and stored secrets; keep it stable and backed up.
- **Workflows execute arbitrary shell commands** on the worker; treat workspace write
  access as code-execution access and run workers with least privilege.
