"""User administration & self-service (Phase 2)."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_superuser, get_current_user
from app.core.database import get_db
from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import hash_password
from app.models.user import User
from app.models.workflow import WorkflowRun
from app.repositories.user import UserRepository
from app.schemas.auth import RegisterRequest
from app.schemas.user import ThemeUpdate, UserAdminUpdate, UserRead, UserUpdate
from app.schemas.workflow import WorkflowRunRead

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserRead, status_code=201)
async def create_user(
    data: RegisterRequest,
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> User:
    from app.services.auth_service import AuthService
    return await AuthService(db).register(data)


@router.get("", response_model=list[UserRead])
async def list_users(
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> list[User]:
    return await UserRepository(db).list()


@router.patch("/me", response_model=UserRead)
async def update_me(
    data: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.password is not None:
        from datetime import UTC, datetime

        user.hashed_password = hash_password(data.password)
        user.last_password_changed = datetime.now(UTC).replace(tzinfo=None)
    await db.flush()
    return user


@router.get("/me/theme", response_model=ThemeUpdate)
async def get_my_theme(
    user: User = Depends(get_current_user),
) -> dict:
    return {"theme_preference": user.theme_preference or "system"}


@router.put("/me/theme", response_model=ThemeUpdate)
async def update_my_theme(
    data: ThemeUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user.theme_preference = data.theme_preference
    await db.flush()
    return {"theme_preference": user.theme_preference}


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: uuid.UUID,
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await UserRepository(db).get(user_id)
    if user is None:
        raise NotFoundError("User not found")
    return user


@router.get("/{user_id}/runs", response_model=list[WorkflowRunRead])
async def get_user_runs(
    user_id: uuid.UUID,
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> list[WorkflowRun]:
    stmt = (
        select(WorkflowRun)
        .where(WorkflowRun.triggered_by_id == user_id)
        .order_by(WorkflowRun.created_at.desc())
        .limit(50)
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.patch("/{user_id}", response_model=UserRead)
async def admin_update_user(
    user_id: uuid.UUID,
    data: UserAdminUpdate,
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await UserRepository(db).get(user_id)
    if user is None:
        raise NotFoundError("User not found")
    if data.username is not None:
        existing = await UserRepository(db).get_by_username(data.username)
        if existing and existing.id != user_id:
            raise ConflictError("Username already taken")
        user.username = data.username
    if data.email is not None:
        existing = await UserRepository(db).get_by_email(data.email.lower())
        if existing and existing.id != user_id:
            raise ConflictError("Email already registered")
        user.email = data.email.lower()
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.password is not None:
        from datetime import UTC, datetime

        user.hashed_password = hash_password(data.password)
        user.last_password_changed = datetime.now(UTC).replace(tzinfo=None)
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.role is not None:
        user.role = data.role
    if data.is_superuser is not None:
        user.is_superuser = data.is_superuser
    await db.flush()
    return user
