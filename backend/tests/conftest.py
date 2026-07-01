"""Test harness: a shared SQLite database backing both the async API path
(via a ``get_db`` dependency override) and the synchronous executor path.

No Postgres, Redis or Celery broker is required — Celery dispatch is stubbed
so workflow execution is driven directly through the synchronous executor,
exactly as the worker would.
"""
import os
import tempfile

# Settings read SECRET_KEY at import time — set before importing the app.
os.environ.setdefault("SECRET_KEY", "test-secret-key-test-secret-key-0123456789")
os.environ.setdefault("WORKSPACES_ROOT", tempfile.mkdtemp(prefix="af-ws-"))

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402

from app.core.database import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402

_DB_FILE = tempfile.mktemp(suffix=".db")
sync_engine = create_engine(
    f"sqlite:///{_DB_FILE}", connect_args={"check_same_thread": False}
)
SyncSessionLocal = sessionmaker(sync_engine, class_=Session, expire_on_commit=False)
async_engine = create_async_engine(f"sqlite+aiosqlite:///{_DB_FILE}")
AsyncSessionLocal = async_sessionmaker(
    async_engine, class_=AsyncSession, expire_on_commit=False
)


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.create_all(sync_engine)
    yield
    Base.metadata.drop_all(sync_engine)


async def _override_get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@pytest_asyncio.fixture
async def client(monkeypatch):
    # Stub Celery dispatch so HTTP triggers just enqueue rows (no broker).
    from app.workers import tasks

    monkeypatch.setattr(
        tasks.run_workflow,
        "delay",
        lambda *a, **k: type("R", (), {"id": "stub-task-id"})(),
    )
    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def db_sync():
    s = SyncSessionLocal()
    try:
        yield s
    finally:
        s.close()
