"""Workspace and membership endpoints (Phase 3)."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    WorkspaceContext,
    get_current_user,
    get_workspace_ctx,
    require_workspace_role,
)
from app.core.database import get_db
from app.core.enums import WorkspaceRole
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.schemas.user import UserRead
from app.schemas.workspace import (
    MemberAdd,
    MemberRead,
    MemberUpdate,
    WorkspaceCreate,
    WorkspaceRead,
    WorkspaceUpdate,
)
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def _read(ws, role: str | None) -> WorkspaceRead:
    out = WorkspaceRead.model_validate(ws)
    out.role = role
    return out


def _member_read(member, user) -> MemberRead:
    return MemberRead(
        id=member.id,
        user_id=member.user_id,
        role=member.role,
        user=UserRead.model_validate(user),
    )


@router.post("", response_model=WorkspaceRead, status_code=201)
async def create_workspace(
    data: WorkspaceCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceRead:
    ws = await WorkspaceService(db).create(data, user.id)
    return _read(ws, WorkspaceRole.OWNER.value)


@router.get("", response_model=list[WorkspaceRead])
async def list_workspaces(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WorkspaceRead]:
    svc = WorkspaceService(db)
    if user.is_superuser:
        workspaces = await svc.list_all()
        roles = {
            m.workspace_id: m.role
            for m in (
                await db.execute(select(WorkspaceMember).where(WorkspaceMember.user_id == user.id))
            ).scalars()
        }
        return [_read(ws, roles.get(ws.id) or WorkspaceRole.OWNER.value) for ws in workspaces]
    workspaces = await svc.list_for_user(user.id)
    roles = {
        m.workspace_id: m.role
        for m in (
            await db.execute(select(WorkspaceMember).where(WorkspaceMember.user_id == user.id))
        ).scalars()
    }
    return [_read(ws, roles.get(ws.id)) for ws in workspaces]


@router.get("/{workspace_id}", response_model=WorkspaceRead)
async def get_workspace(
    ctx: WorkspaceContext = Depends(get_workspace_ctx),
) -> WorkspaceRead:
    return _read(ctx.workspace, ctx.role)


@router.patch("/{workspace_id}", response_model=WorkspaceRead)
async def update_workspace(
    data: WorkspaceUpdate,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MAINTAINER)),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceRead:
    ws = await WorkspaceService(db).update(ctx.workspace, data)
    return _read(ws, ctx.role)


@router.delete("/{workspace_id}", status_code=204)
async def delete_workspace(
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.OWNER)),
    db: AsyncSession = Depends(get_db),
) -> None:
    await WorkspaceService(db).delete(ctx.workspace)


# --- members -----------------------------------------------------------------
@router.get("/{workspace_id}/members", response_model=list[MemberRead])
async def list_members(
    ctx: WorkspaceContext = Depends(get_workspace_ctx),
    db: AsyncSession = Depends(get_db),
) -> list[MemberRead]:
    members = await db.execute(
        select(WorkspaceMember).where(WorkspaceMember.workspace_id == ctx.workspace.id)
    )
    members = list(members.scalars().all())
    out: list[MemberRead] = []
    for m in members:
        user = await db.get(User, m.user_id)
        out.append(_member_read(m, user))
    return out


@router.post("/{workspace_id}/members", response_model=MemberRead, status_code=201)
async def add_member(
    data: MemberAdd,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MAINTAINER)),
    db: AsyncSession = Depends(get_db),
) -> MemberRead:
    member = await WorkspaceService(db).add_member(ctx.workspace, data.username, data.role)
    user = await db.get(User, member.user_id)
    return _member_read(member, user)


@router.patch("/{workspace_id}/members/{member_id}", response_model=MemberRead)
async def update_member(
    member_id: uuid.UUID,
    data: MemberUpdate,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MAINTAINER)),
    db: AsyncSession = Depends(get_db),
) -> MemberRead:
    member = await WorkspaceService(db).update_member(ctx.workspace, member_id, data.role)
    user = await db.get(User, member.user_id)
    return _member_read(member, user)


@router.delete("/{workspace_id}/members/{member_id}", status_code=204)
async def remove_member(
    member_id: uuid.UUID,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MAINTAINER)),
    db: AsyncSession = Depends(get_db),
) -> None:
    await WorkspaceService(db).remove_member(ctx.workspace, member_id)
