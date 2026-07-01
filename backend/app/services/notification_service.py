"""Notification creation and retrieval (Phase 11)."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.notification import Notification
from app.repositories.notification import NotificationRepository


class NotificationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = NotificationRepository(db)

    async def create(
        self,
        user_id: uuid.UUID,
        title: str,
        message: str = "",
        *,
        type: str = "info",
        link: str | None = None,
        workspace_id: uuid.UUID | None = None,
    ) -> Notification:
        n = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=type,
            link=link,
            workspace_id=workspace_id,
        )
        return await self.repo.add(n)

    async def list(self, user_id: uuid.UUID, *, unread_only: bool = False):
        return await self.repo.list_for_user(user_id, unread_only=unread_only)

    async def unread_count(self, user_id: uuid.UUID) -> int:
        return await self.repo.unread_count(user_id)

    async def mark_read(self, user_id: uuid.UUID, notification_id: uuid.UUID) -> Notification:
        n = await self.repo.get(notification_id)
        if n is None or n.user_id != user_id:
            raise NotFoundError("Notification not found")
        n.is_read = True
        await self.db.flush()
        return n

    async def mark_all_read(self, user_id: uuid.UUID) -> None:
        await self.repo.mark_all_read(user_id)
