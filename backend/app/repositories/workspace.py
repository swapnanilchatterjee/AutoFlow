"""Workspace + membership repositories."""
import uuid

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.workspace import Workspace, WorkspaceMember
from app.repositories.base import BaseRepository


class WorkspaceRepository(BaseRepository[Workspace]):
    model = Workspace

    async def get_by_slug(self, slug: str) -> Workspace | None:
        res = await self.session.execute(select(Workspace).where(Workspace.slug == slug))
        return res.scalar_one_or_none()

    async def list_for_user(self, user_id: uuid.UUID) -> list[Workspace]:
        """Workspaces where the user is a member (ownership implies membership)."""
        stmt = (
            select(Workspace)
            .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
            .where(WorkspaceMember.user_id == user_id)
            .order_by(Workspace.created_at.desc())
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().unique().all())


class MemberRepository(BaseRepository[WorkspaceMember]):
    model = WorkspaceMember

    async def get(self, id_: uuid.UUID) -> WorkspaceMember | None:
        return await self.session.get(WorkspaceMember, id_)

    async def get_membership(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID
    ) -> WorkspaceMember | None:
        res = await self.session.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user_id,
            )
        )
        return res.scalar_one_or_none()

    async def list_members(self, workspace_id: uuid.UUID) -> list[WorkspaceMember]:
        stmt = (
            select(WorkspaceMember)
            .options(selectinload(WorkspaceMember.workspace))
            .where(WorkspaceMember.workspace_id == workspace_id)
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all())
