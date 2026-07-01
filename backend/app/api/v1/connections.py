"""Messaging connection (integration) endpoints.

Configure Gmail / Telegram / WhatsApp credentials per workspace so workflows
can deliver reports. Secret config values are write-only.
"""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import WorkspaceContext, get_workspace_ctx, require_workspace_role
from app.core.database import get_db
from app.core.enums import WorkspaceRole
from app.integrations.registry import catalog
from app.schemas.common import Message
from app.schemas.connection import (
    ConnectionCreate,
    ConnectionRead,
    ConnectionTestRequest,
    ConnectionTestResult,
    ConnectionUpdate,
)
from app.services.connection_service import ConnectionService

router = APIRouter(prefix="/workspaces/{workspace_id}/connections", tags=["integrations"])


@router.get("/catalog")
async def channel_catalog(_: WorkspaceContext = Depends(get_workspace_ctx)) -> list[dict]:
    """Available channels and their configurable fields (drives the settings UI)."""
    return catalog()


@router.get("", response_model=list[ConnectionRead])
async def list_connections(
    ctx: WorkspaceContext = Depends(get_workspace_ctx),
    db: AsyncSession = Depends(get_db),
) -> list[ConnectionRead]:
    return await ConnectionService(db).list(ctx.workspace.id)


@router.post("", response_model=ConnectionRead, status_code=201)
async def create_connection(
    data: ConnectionCreate,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MAINTAINER)),
    db: AsyncSession = Depends(get_db),
) -> ConnectionRead:
    return await ConnectionService(db).create(ctx.workspace.id, data)


@router.patch("/{connection_id}", response_model=ConnectionRead)
async def update_connection(
    connection_id: uuid.UUID,
    data: ConnectionUpdate,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MAINTAINER)),
    db: AsyncSession = Depends(get_db),
) -> ConnectionRead:
    return await ConnectionService(db).update(ctx.workspace.id, connection_id, data)


@router.delete("/{connection_id}", response_model=Message)
async def delete_connection(
    connection_id: uuid.UUID,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MAINTAINER)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    await ConnectionService(db).delete(ctx.workspace.id, connection_id)
    return Message(detail="Connection deleted")


@router.post("/{connection_id}/test", response_model=ConnectionTestResult)
async def test_connection(
    connection_id: uuid.UUID,
    data: ConnectionTestRequest,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MAINTAINER)),
    db: AsyncSession = Depends(get_db),
) -> ConnectionTestResult:
    return await ConnectionService(db).test(ctx.workspace.id, connection_id, data.to, data.include_attachment)
