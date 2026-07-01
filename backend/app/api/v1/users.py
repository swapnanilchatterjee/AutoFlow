"""User administration & self-service (Phase 2)."""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_superuser, get_current_user
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.core.security import hash_password
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.user import UserAdminUpdate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


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
        user.hashed_password = hash_password(data.password)
    await db.flush()
    return user


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
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.role is not None:
        user.role = data.role
    await db.flush()
    return user
