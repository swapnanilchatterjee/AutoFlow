"""Shared FastAPI dependencies: DB session, auth, and workspace access control."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

import jwt
from fastapi import Depends, Path
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.enums import WorkspaceRole
from app.core.exceptions import ForbiddenError, NotFoundError, UnauthorizedError
from app.core.security import decode_token
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.repositories.user import UserRepository
from app.repositories.workspace import MemberRepository, WorkspaceRepository

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_PREFIX}/auth/login", auto_error=False
)

# Workspace role privilege ordering (higher index = more privilege).
_ROLE_ORDER = [
    WorkspaceRole.VIEWER,
    WorkspaceRole.MEMBER,
    WorkspaceRole.MAINTAINER,
    WorkspaceRole.OWNER,
]


def role_rank(role: str) -> int:
    try:
        return _ROLE_ORDER.index(WorkspaceRole(role))
    except ValueError:
        return -1


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not token:
        raise UnauthorizedError("Not authenticated")
    try:
        payload = decode_token(token, expected_type="access")
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise UnauthorizedError("Invalid or expired token") from exc

    user = await UserRepository(db).get(user_id)
    if user is None:
        raise UnauthorizedError("User no longer exists")
    if not user.is_active:
        raise ForbiddenError("User account is disabled")
    return user


async def get_current_superuser(
    user: User = Depends(get_current_user),
) -> User:
    if not user.is_superuser:
        raise ForbiddenError("Superuser privileges required")
    return user


@dataclass
class WorkspaceContext:
    """Resolved workspace + the caller's membership/role."""

    workspace: Workspace
    member: WorkspaceMember | None
    role: str
    _user_id: uuid.UUID | None = None

    @property
    def user_id(self) -> uuid.UUID:
        if self.member is not None:
            return self.member.user_id
        if self._user_id is not None:
            return self._user_id
        return self.workspace.owner_id

    def require(self, minimum: WorkspaceRole) -> None:
        if role_rank(self.role) < role_rank(minimum.value):
            raise ForbiddenError(f"Requires '{minimum.value}' role (you have '{self.role}')")


async def get_workspace_ctx(
    workspace_id: uuid.UUID = Path(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceContext:
    workspace = await WorkspaceRepository(db).get(workspace_id)
    if workspace is None:
        raise NotFoundError("Workspace not found")

    # Superusers get implicit owner access to every workspace.
    if user.is_superuser:
        member = await MemberRepository(db).get_membership(workspace_id, user.id)
        role = member.role if member else WorkspaceRole.OWNER.value
        return WorkspaceContext(workspace, member, role, _user_id=user.id)

    member = await MemberRepository(db).get_membership(workspace_id, user.id)
    if member is None:
        raise NotFoundError("Workspace not found")  # hide existence from non-members
    return WorkspaceContext(workspace, member, member.role, _user_id=user.id)


def require_workspace_role(minimum: WorkspaceRole):
    """Dependency factory enforcing a minimum workspace role."""

    async def _dep(ctx: WorkspaceContext = Depends(get_workspace_ctx)) -> WorkspaceContext:
        ctx.require(minimum)
        return ctx

    return _dep
