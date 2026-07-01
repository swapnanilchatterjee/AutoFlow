"""Read side of the report delivery log (integrations).

Delivery rows are written by the executor while running action steps. This service
reads them back for the Delivery log UI, scoped to the workspaces a user can access.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.delivery import Delivery
from app.models.workspace import Workspace, WorkspaceMember
from app.schemas.delivery import DeliveryRead


def _split(value: str | None) -> list[str]:
    if not value:
        return []
    return [p.strip() for p in value.split(",") if p.strip()]


def _to_read(d: Delivery, slug: str | None) -> DeliveryRead:
    return DeliveryRead(
        id=str(d.id),
        workspace_id=str(d.workspace_id),
        workspace_slug=slug,
        workflow_id=str(d.workflow_id) if d.workflow_id else None,
        workflow_name=d.workflow_name,
        run_id=str(d.run_id) if d.run_id else None,
        run_number=d.run_number,
        step_name=d.step_name,
        channel=d.channel,
        connection_name=d.connection_name,
        recipients=_split(d.recipients),
        recipient_count=d.recipient_count,
        body_format=d.body_format,
        subject=d.subject,
        attachment_count=d.attachment_count,
        status=d.status,
        detail=d.detail,
        provider_refs=_split(d.provider_refs),
        created_at=d.created_at,
        started_at=d.started_at,
        finished_at=d.finished_at,
    )


class DeliveryService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _workspace_ids(self, user_id: uuid.UUID, is_superuser: bool) -> list[uuid.UUID]:
        if is_superuser:
            res = await self.db.execute(select(Workspace.id))
            return list(res.scalars().all())
        res = await self.db.execute(
            select(WorkspaceMember.workspace_id).where(WorkspaceMember.user_id == user_id)
        )
        return list(res.scalars().all())

    async def _list(
        self,
        ws_ids: list[uuid.UUID],
        *,
        limit: int,
        status: str | None,
        channel: str | None,
        workspace_id: uuid.UUID | None,
    ) -> list[DeliveryRead]:
        if not ws_ids:
            return []
        stmt = (
            select(Delivery, Workspace.slug)
            .join(Workspace, Workspace.id == Delivery.workspace_id)
            .where(Delivery.workspace_id.in_(ws_ids))
        )
        if workspace_id is not None:
            stmt = stmt.where(Delivery.workspace_id == workspace_id)
        if status:
            stmt = stmt.where(Delivery.status == status)
        if channel:
            stmt = stmt.where(Delivery.channel == channel)
        stmt = stmt.order_by(Delivery.created_at.desc()).limit(limit)
        rows = (await self.db.execute(stmt)).all()
        return [_to_read(d, slug) for d, slug in rows]

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        is_superuser: bool,
        *,
        limit: int = 50,
        status: str | None = None,
        channel: str | None = None,
        workspace_id: uuid.UUID | None = None,
    ) -> list[DeliveryRead]:
        ws_ids = await self._workspace_ids(user_id, is_superuser)
        return await self._list(
            ws_ids, limit=limit, status=status, channel=channel, workspace_id=workspace_id
        )

    async def list_for_workspace(
        self,
        workspace_id: uuid.UUID,
        *,
        limit: int = 50,
        status: str | None = None,
        channel: str | None = None,
    ) -> list[DeliveryRead]:
        return await self._list(
            [workspace_id], limit=limit, status=status, channel=channel, workspace_id=None
        )
