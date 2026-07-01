"""Aggregate router for API v1 — all feature routers mounted here."""
from fastapi import APIRouter

from app.api.v1 import (
    auth,
    connections,
    dashboard,
    deliveries,
    files,
    git,
    health,
    notifications,
    secrets,
    users,
    webhooks,
    workflows,
    workspaces,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(workspaces.router)
api_router.include_router(connections.router)
api_router.include_router(deliveries.router)
api_router.include_router(files.router)
api_router.include_router(git.router)
api_router.include_router(secrets.router)
api_router.include_router(workflows.router)
api_router.include_router(webhooks.router)
api_router.include_router(notifications.router)
api_router.include_router(dashboard.router)
