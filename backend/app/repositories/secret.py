"""Secret + variable repositories."""
import uuid

from sqlalchemy import select

from app.models.secret import Secret, Variable
from app.repositories.base import BaseRepository


class SecretRepository(BaseRepository[Secret]):
    model = Secret

    async def list_for_workspace(self, workspace_id: uuid.UUID) -> list[Secret]:
        res = await self.session.execute(
            select(Secret).where(Secret.workspace_id == workspace_id).order_by(Secret.key)
        )
        return list(res.scalars().all())

    async def get_by_key(self, workspace_id: uuid.UUID, key: str) -> Secret | None:
        res = await self.session.execute(
            select(Secret).where(Secret.workspace_id == workspace_id, Secret.key == key)
        )
        return res.scalar_one_or_none()


class VariableRepository(BaseRepository[Variable]):
    model = Variable

    async def list_for_workspace(self, workspace_id: uuid.UUID) -> list[Variable]:
        res = await self.session.execute(
            select(Variable).where(Variable.workspace_id == workspace_id).order_by(Variable.key)
        )
        return list(res.scalars().all())

    async def get_by_key(self, workspace_id: uuid.UUID, key: str) -> Variable | None:
        res = await self.session.execute(
            select(Variable).where(Variable.workspace_id == workspace_id, Variable.key == key)
        )
        return res.scalar_one_or_none()
