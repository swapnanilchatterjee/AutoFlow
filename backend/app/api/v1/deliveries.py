"""Report delivery log endpoints (integrations).

A global feed across the caller's workspaces, plus a workspace-scoped list.
"""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import WorkspaceContext, get_current_user, get_workspace_ctx
from app.core.database import get_db
from app.models.user import User
from app.schemas.delivery import DeliveryRead
from app.services.delivery_service import DeliveryService

router = APIRouter(tags=["integrations"])


@router.get("/deliveries", response_model=list[DeliveryRead])
async def list_deliveries(
    limit: int = Query(50, ge=1, le=200),
    status: str | None = None,
    channel: str | None = None,
    workspace_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DeliveryRead]:
    return await DeliveryService(db).list_for_user(
        user.id, user.is_superuser,
        limit=limit, status=status, channel=channel, workspace_id=workspace_id,
    )


@router.get("/workspaces/{workspace_id}/deliveries", response_model=list[DeliveryRead])
async def list_workspace_deliveries(
    limit: int = Query(50, ge=1, le=200),
    status: str | None = None,
    channel: str | None = None,
    ctx: WorkspaceContext = Depends(get_workspace_ctx),
    db: AsyncSession = Depends(get_db),
) -> list[DeliveryRead]:
    return await DeliveryService(db).list_for_workspace(
        ctx.workspace.id, limit=limit, status=status, channel=channel,
    )
