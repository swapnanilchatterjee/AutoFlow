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
- **Scheduler** — cron-scheduled workflows (evaluated every minute) and scheduled heartbeat/diagnostic checks directly on integrations.
- **Webhooks** — unguessable public trigger URLs with built-in test tool.
- **Runs & logs** — per-step status, exit code, timing, and live-tailed output styled with line numbers like GitHub Actions, plus individual step and run-level raw log downloading. Search and filter runs by status, date range, and keywords.
- **Notifications** — in-app, on run completion.
- **Dashboard** — counts, success rate, recent runs, customizable stat cards.
- **Dark/Light theme** — toggle with system preference detection and server-side persistence.
- **Collapsible sidebar** — expand/collapse with icon-only mode, persisted across sessions.
- **Cron expression builder** — visual preset buttons with human-readable next-run preview.
- **Workflow templates** — pre-built templates (backup, report, health check, ETL) with one-click clone.
- **Workflow import/export** — download YAML definitions and upload from file.
- **API token management** — generate/revoke personal access tokens for programmatic workflow triggering.
- **SMTP configuration** — admin settings page to configure email delivery for notifications and password resets.
- **Audit log** — global activity feed showing all user actions across workspaces.
- **Data retention policies** — auto-delete old runs and logs based on configurable age thresholds.
- **Session management** — view and manage active login sessions.
- **Runner node management** — detailed worker information with pool restart and shutdown controls.
- **Onboarding wizard** — guided first-time setup for new users.
- **Premium UI** — animated gradients, glassmorphism, smooth transitions, responsive mobile design.

## Tech stack

| Layer       | Technologies                                                                    |
|-------------|---------------------------------------------------------------------------------|
| Backend     | Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2                       |
| Async jobs  | Celery (worker + beat), Redis (broker + result backend)                         |
| Database    | PostgreSQL 16                                                                    |
| Security    | PyJWT (HS256), bcrypt, cryptography (Fernet)                                     |
| Engine libs | PyYAML (parse), croniter (schedule), GitPython (Git)                             |
| Frontend    | React 18, TypeScript, Vite, React Router, TailwindCSS, croner                   |
| Ops         | Docker Compose (6 services), Makefile                                            |

## Codebase at a glance

| Metric                | Count   |
|-----------------------|---------|
| Backend Python files  | 94 (~3,840 LOC) |
| Frontend TS/TSX files | 36 (~1,920 LOC) |
| REST API endpoints    | 99      |
| Database tables       | 16      |
| ORM model files       | 9       |
| Service classes       | 10      |
| Repository classes    | 8       |
| API routers           | 15      |
| Test suite            | 16 passed, all green |

## Status & verification

**Complete — all 13 phases shipped and verified.**

- **Integration suite (6/6 pytest, SQLite-backed, hermetic)** exercises the real stack:
  first-user-admin + RBAC (incl. 403/404 paths), password verification, JWT round-trip,
  invalid-YAML rejection (422), file write round-trip, Git init + commit, and a full
  workflow run through the **synchronous executor** — env/variable/secret injection,
  artifact written to the workspace, fail-stops-pipeline + step skipping, failure
  notification, and dashboard aggregation.
- **`ruff` clean** across the backend; app imports with **99 routes** registered.
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

## UI/UX Polish & Accessibility Upgrades (July 2026)

To deliver a premium, state-of-the-art developer experience, the platform received a major interface overhaul:
- **Dashboard Metric Enhancements:** KPI card borders were hardened with a crisp, solid black border (`!border-black`) to improve visual hierarchy and scannability on light themes.
- **Vibrant Animated Login & Registration:** Replaced the plain login page background with a dynamic, fluid, animated linear gradient mesh that cycles smoothly between indigo, pink, blue, cyan, and purple. Designed a centered dark glassmorphic card container (`backdrop-blur-xl bg-slate-900/75 border border-white/10`) featuring high-contrast typography, premium focus states, and input field glassmorphism.
- **Themed Modal System:** Overhauled all modal overlays to feature a custom semi-transparent blurred backdrop (`bg-slate-950/60 backdrop-blur-sm`), a structural top accent bar in brand purple, and clean gradient headers (`bg-gradient-to-r from-slate-50 to-indigo-50/20`) to draw visual focus to dialog screens.
- **Friendly Workspace Roles Mapping:** Realigned technical database roles with highly readable team access permissions in the workspace members tab:
  - `viewer` ➔ `read`
  - `member` ➔ `write`
  - `maintainer` ➔ `edit` / `coadmin`
  - `owner` ➔ `owner`
- **Dynamic Role Management:** Enabled workspace maintainers/owners to change access levels for all members (including owners) directly from a select dropdown with active error toast feedback.
- **Admin Security, Shell Logs, & Pagination (July 2026):**
  - **Admin Registration Token**: Added support for an environment-configured `ADMIN_REGISTRATION_TOKEN` that can be entered during signup to claim superuser (admin) status securely.
  - **Shell Step Logs Tracking**: Integrated all shell step (`run:`) execution histories into the global Deliveries log alongside action integrations, rendered with a dedicated `Terminal` icon and filterable by `Shell` channel.
  - **Dashboard Logs Pagination**: Paginated the dashboard's "Execution details log" table to display only the last 5 logs initially. Users can load more in increments of 5 up to a maximum of 25. Once 25 logs are reached, the action button redirects the user to the full Logs section.

