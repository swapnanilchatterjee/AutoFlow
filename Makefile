.RECIPEPREFIX := >
.PHONY: help up down build logs migrate makemigration shell-api shell-db fmt lint test

help:
> @echo "AutoFlow - make targets"
> @echo "  up             Start the full stack (detached)"
> @echo "  down           Stop and remove containers"
> @echo "  build          Rebuild images"
> @echo "  logs           Tail logs from all services"
> @echo "  migrate        Apply DB migrations (alembic upgrade head)"
> @echo "  makemigration  Generate a migration:  make makemigration m=\"message\""
> @echo "  shell-api      Open a shell in the api container"
> @echo "  shell-db       Open psql in the postgres container"
> @echo "  fmt            Format backend (black + ruff --fix)"
> @echo "  lint           Lint backend (ruff + mypy)"
> @echo "  test           Run backend tests"

up:
> docker compose up -d

down:
> docker compose down

build:
> docker compose build

logs:
> docker compose logs -f

migrate:
> docker compose exec api alembic upgrade head

makemigration:
> docker compose exec api alembic revision --autogenerate -m "$(m)"

shell-api:
> docker compose exec api bash

shell-db:
> docker compose exec postgres psql -U autoflow -d autoflow

fmt:
> docker compose exec api bash -c "black . && ruff check --fix ."

lint:
> docker compose exec api bash -c "ruff check . && mypy app"

test:
> docker compose exec api pytest
