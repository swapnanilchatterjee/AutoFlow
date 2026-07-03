# AutoFlow — Setup Guide

This guide covers two ways to run AutoFlow:

- **Path A — Docker Compose** (recommended): one command brings up the whole stack.
- **Path B — Local / manual**: run each service on your host (useful for debugging a
  single service or working without Docker).

---

## Prerequisites

**Path A (Docker):**
- Docker Engine 24+ with the Docker Compose v2 plugin (`docker compose`, not the old
  `docker-compose`). Docker Desktop on macOS/Windows includes both.

**Path B (local):**
- Python **3.12+**
- Node.js **20+** and npm
- PostgreSQL **16** running and reachable
- Redis **7** running and reachable

Verify:

```bash
docker --version && docker compose version   # Path A
python3 --version && node --version          # Path B
```

---

## 1. Get the code

```bash
# from the unzipped folder
cd autoflow
```

---

## 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and review the values. The only one you **must** change is `SECRET_KEY`
(used for JWT signing from Phase 2). The app refuses to start if it is shorter than
32 characters.

### Generate a SECRET_KEY

```bash
openssl rand -hex 32
```

Paste the output into `.env`:

```
SECRET_KEY=<your-64-char-hex-string>
```

> **Host names matter.** Inside Docker, services talk to each other by service name,
> so keep `POSTGRES_HOST=postgres` and `REDIS_HOST=redis`. For **local** (Path B) dev,
> change both to `localhost` and set `WORKSPACES_ROOT` to a local path like `./workspaces`.

---

## Path A — Run with Docker Compose (recommended)

### 3A. Build and start

```bash
docker compose up -d --build
```

This starts six services:

| Service     | Container role            | Host port |
|-------------|---------------------------|-----------|
| `postgres`  | Database                  | 5432      |
| `redis`     | Broker / cache            | 6379      |
| `api`       | FastAPI (uvicorn, reload) | 8000      |
| `worker`    | Celery worker             | —         |
| `scheduler` | Celery Beat               | —         |
| `frontend`  | Vite dev server           | 5173      |

`postgres` and `redis` have health checks; `api`, `worker`, and `scheduler` wait for
them to be healthy before starting.

### 4A. Verify

```bash
# API liveness
curl http://localhost:8000/api/v1/health
# -> {"status":"ok","service":"AutoFlow","environment":"development"}

# Readiness (checks DB + Redis)
curl http://localhost:8000/api/v1/health/ready
# -> {"status":"ok","checks":{"database":"ok","redis":"ok"}}
```

Then open in a browser:

- **API docs (Swagger):** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Frontend:** http://localhost:5173 — the card should show a green `● ok` API status.

Confirm the worker is connected:

```bash
docker compose exec api python -c "from app.workers.tasks import ping; print(ping.delay().get(timeout=10))"
# -> pong
```

### 5A. Database migrations

The schema ships as an Alembic migration (`alembic/versions/0001_initial.py`) that
creates all tables. Apply it once after the stack is up:

```bash
docker compose exec api alembic upgrade head    # or: make migrate
```

To add or change tables later:

```bash
make makemigration m="add widgets table"   # autogenerate from model changes
make migrate                               # apply (alembic upgrade head)
```

(Equivalently: `docker compose exec api alembic revision --autogenerate -m "..."` and
`docker compose exec api alembic upgrade head`.)

### 6A. First run — create your first automation

1. Open **http://localhost:5173** and click **Create one** to register. The **first
   account becomes the platform admin** (or you can register admins using a secure `ADMIN_REGISTRATION_TOKEN` if defined in `.env`).
2. **New workspace** → give it a name. You're the `owner`.
3. (Optional) **Secrets** tab → add a secret (encrypted) or a variable. Both are
   injected as environment variables into every run.
4. **Workflows** tab → **New workflow** → pick a trigger (`manual` to start). You land
   on the workflow page with a starter YAML.
5. Edit the YAML if you like, **Save**, then **Run now**. You're taken to the run page
   where each step's status, exit code, and **logs stream live**.

To trigger a **webhook** workflow from outside (set its trigger to `webhook` first, then
copy the URL shown on the workflow page):

```bash
curl -X POST http://localhost:8000/api/v1/webhooks/<token>
# -> {"run_id":"...","run_number":1,"status":"queued"}
```

### Common Docker commands

```bash
docker compose logs -f            # tail all logs
docker compose logs -f api        # tail one service
docker compose ps                 # service status
docker compose restart api        # restart a service
docker compose down               # stop & remove containers (keeps volumes)
docker compose down -v            # ALSO delete volumes (wipes DB + workspaces)
```

The `Makefile` wraps the most common ones — run `make help`.

---

## Path B — Run locally without Docker

Make sure PostgreSQL and Redis are running on your host, and that `.env` has
`POSTGRES_HOST=localhost`, `REDIS_HOST=localhost`, and a local `WORKSPACES_ROOT`
(e.g. `WORKSPACES_ROOT=./workspaces`). Create the database once:

```bash
createdb autoflow   # or: psql -c "CREATE DATABASE autoflow;"
mkdir -p workspaces
```

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

# load .env into the shell (the api reads it automatically, but workers/alembic
# benefit from it being exported)
set -a && source ../.env && set +a

# create all tables (run once)
alembic upgrade head

# API (terminal 1)
uvicorn app.main:app --reload --port 8000

# Worker (terminal 2)
celery -A app.workers.celery_app:celery_app worker --loglevel=info

# Scheduler (terminal 3)
celery -A app.workers.celery_app:celery_app beat --loglevel=info
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Vite serves on http://localhost:5173 and proxies /api -> http://localhost:8000
```

### Tests, lint, format (local)

```bash
cd backend && source .venv/bin/activate
pytest -q          # tests
ruff check app     # lint
mypy app           # type-check
black .            # format
```

---

## Configuration reference

All settings come from environment variables / `.env` and are defined in
`backend/app/core/config.py`.

| Variable                      | Default                 | Notes                                   |
|-------------------------------|-------------------------|-----------------------------------------|
| `PROJECT_NAME`                | `AutoFlow`              | Shown in API + UI                       |
| `ENVIRONMENT`                 | `development`           | `development`/`staging`/`production`    |
| `DEBUG`                       | `true`                  | Verbose logs, SQL echo                  |
| `SECRET_KEY`                  | —                       | **Required**, ≥ 32 chars                |
| `ADMIN_REGISTRATION_TOKEN`    | —                       | Optional admin registration token       |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30`                    | Used from Phase 2                       |
| `REFRESH_TOKEN_EXPIRE_DAYS`   | `7`                     | Used from Phase 2                       |
| `BACKEND_CORS_ORIGINS`        | `localhost:5173,:3000`  | Comma-separated origins                 |
| `POSTGRES_HOST`               | `postgres`              | `localhost` for Path B                  |
| `POSTGRES_PORT`               | `5432`                  |                                         |
| `POSTGRES_USER`               | `autoflow`              |                                         |
| `POSTGRES_PASSWORD`           | `autoflow`              | Change for any shared environment       |
| `POSTGRES_DB`                 | `autoflow`              |                                         |
| `REDIS_HOST`                  | `redis`                 | `localhost` for Path B                  |
| `REDIS_PORT`                  | `6379`                  |                                         |
| `REDIS_DB`                    | `0`                     | Celery uses DBs 1 (broker) & 2 (results)|
| `WORKSPACES_ROOT`             | `/data/workspaces`      | Mounted volume in Docker                |

---

## Troubleshooting

**`SECRET_KEY` / validation error on startup**
The API exits immediately if `SECRET_KEY` is missing or under 32 characters. Generate
one with `openssl rand -hex 32` and put it in `.env`. If you changed `.env` after the
stack was already up: `docker compose up -d` (Compose re-reads `.env` on `up`).

**Port already in use (5432 / 6379 / 8000 / 5173)**
Something else is using the port. Either stop that process, or change the host-side
port in `docker-compose.yml` (e.g. `"5433:5432"`) and reconnect using the new port.

**Frontend shows a red API error**
The API isn't reachable. Check `docker compose ps` (is `api` up?) and
`docker compose logs api`. In Docker the frontend proxies `/api` to `http://api:8000`;
locally it proxies to `http://localhost:8000` — make sure the API is running there.

**`database`/`redis` shows `error` on `/health/ready`**
A dependency isn't ready. `docker compose ps` should show `postgres` and `redis` as
healthy; check their logs. For Path B, confirm both are running and that
`POSTGRES_HOST`/`REDIS_HOST` are set to `localhost`.

**Worker won't pick up the `ping` task**
Confirm the worker container is running (`docker compose logs worker`) and that Redis
is healthy. The worker command must reference the app as
`app.workers.celery_app:celery_app`.

**Code changes not reflected**
The `api`, `worker`, `scheduler` containers bind-mount `./backend`, and the API runs
with `--reload`. The worker and scheduler do **not** auto-reload — restart them after
changing task code: `docker compose restart worker scheduler`.

**Frontend `node_modules` issues after editing `package.json`**
The frontend uses an anonymous volume for `node_modules`. After changing dependencies,
rebuild: `docker compose build frontend && docker compose up -d frontend`.

---

## Reset everything

```bash
docker compose down -v     # removes containers AND volumes (DB + workspaces wiped)
docker compose up -d --build
```

---

## A note on `SECRET_KEY`

`SECRET_KEY` does double duty: it signs JWTs **and** derives the Fernet key that
encrypts workspace secrets. Choose it once and keep it stable. **If you rotate it, every
stored secret becomes undecryptable** and must be re-entered; existing user sessions
are also invalidated (users just log in again). Back it up with your deployment config.

---

## Next

All 13 phases are complete — see the roadmap and the **workflow format** reference in
the [README](../README.md). If you expose this instance publicly, review the
**Security notes** in the README first (the first registered user is admin, and
workflows execute arbitrary shell commands on the worker).

