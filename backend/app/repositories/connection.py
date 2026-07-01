"""Data access for messaging connections."""
from __future__ import annotations

import uuid

from sqlalchemy import select

from app.models.connection import Connection
from app.repositories.base import BaseRepository


class ConnectionRepository(BaseRepository[Connection]):
    model = Connection

    async def list_for_workspace(self, workspace_id: uuid.UUID) -> list[Connection]:
        res = await self.session.execute(
            select(Connection)
            .where(Connection.workspace_id == workspace_id)
            .order_by(Connection.type, Connection.name)
        )
        return list(res.scalars().all())

    async def get_by_name(self, workspace_id: uuid.UUID, name: str) -> Connection | None:
        res = await self.session.execute(
            select(Connection).where(
                Connection.workspace_id == workspace_id, Connection.name == name
            )
        )
        return res.scalar_one_or_none()
