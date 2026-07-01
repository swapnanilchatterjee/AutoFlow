"""Workspace lifecycle and membership management (Phase 3)."""
from __future__ import annotations

import re
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import WorkspaceRole
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.storage import ensure_workspace_dir
from app.models.workspace import Workspace, WorkspaceMember
from app.repositories.user import UserRepository
from app.repositories.workspace import MemberRepository, WorkspaceRepository
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "workspace"


class WorkspaceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = WorkspaceRepository(db)
        self.members = MemberRepository(db)
        self.users = UserRepository(db)

    async def _unique_slug(self, name: str) -> str:
        base = slugify(name)
        slug = base
        i = 2
        while await self.repo.get_by_slug(slug):
            slug = f"{base}-{i}"
            i += 1
        return slug

    async def create(self, data: WorkspaceCreate, owner_id: uuid.UUID) -> Workspace:
        slug = await self._unique_slug(data.name)
        ws = Workspace(
            name=data.name, slug=slug, description=data.description, owner_id=owner_id
        )
        ws = await self.repo.add(ws)
        # Owner is automatically a member with the OWNER role.
        await self.members.add(
            WorkspaceMember(
                workspace_id=ws.id, user_id=owner_id, role=WorkspaceRole.OWNER.value
            )
        )
        ensure_workspace_dir(ws.id)
        return ws

    async def list_for_user(self, user_id: uuid.UUID) -> list[Workspace]:
        return await self.repo.list_for_user(user_id)

    async def update(self, ws: Workspace, data: WorkspaceUpdate) -> Workspace:
        if data.name is not None:
            ws.name = data.name
        if data.description is not None:
            ws.description = data.description
        await self.db.flush()
        return ws

    async def delete(self, ws: Workspace) -> None:
        await self.repo.delete(ws)

    # --- membership ----------------------------------------------------------
    async def list_members(self, workspace_id: uuid.UUID) -> list[WorkspaceMember]:
        members = await self.members.list_members(workspace_id)
        # eager-load user objects
        for m in members:
            await self.db.refresh(m, ["workspace"])
        return members

    async def add_member(
        self, ws: Workspace, login: str, role: str
    ) -> WorkspaceMember:
        if role not in {r.value for r in WorkspaceRole}:
            raise ConflictError(f"Invalid role '{role}'")
        user = await self.users.get_by_login(login)
        if user is None:
            raise NotFoundError(f"No user matching '{login}'")
        if await self.members.get_membership(ws.id, user.id):
            raise ConflictError("User is already a member")
        try:
            member = await self.members.add(
                WorkspaceMember(workspace_id=ws.id, user_id=user.id, role=role)
            )
        except IntegrityError as exc:
            raise ConflictError("User is already a member") from exc
        return member

    async def update_member(
        self, ws: Workspace, member_id: uuid.UUID, role: str
    ) -> WorkspaceMember:
        if role not in {r.value for r in WorkspaceRole}:
            raise ConflictError(f"Invalid role '{role}'")
        member = await self.members.get(member_id)
        if member is None or member.workspace_id != ws.id:
            raise NotFoundError("Member not found")
        if member.user_id == ws.owner_id and role != WorkspaceRole.OWNER.value:
            raise ForbiddenError("Cannot demote the workspace owner")
        member.role = role
        await self.db.flush()
        return member

    async def remove_member(self, ws: Workspace, member_id: uuid.UUID) -> None:
        member = await self.members.get(member_id)
        if member is None or member.workspace_id != ws.id:
            raise NotFoundError("Member not found")
        if member.user_id == ws.owner_id:
            raise ForbiddenError("Cannot remove the workspace owner")
        await self.members.delete(member)
