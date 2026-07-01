"""Authentication & registration logic (Phase 2)."""
from __future__ import annotations

import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import UserRole
from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.auth import RegisterRequest, Token


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.users = UserRepository(db)

    async def register(self, data: RegisterRequest) -> User:
        if await self.users.get_by_email(data.email.lower()):
            raise ConflictError("Email already registered")
        if await self.users.get_by_username(data.username):
            raise ConflictError("Username already taken")

        # First user to register becomes the platform superuser/admin.
        first = not await self.users.any_exist()
        user = User(
            email=data.email.lower(),
            username=data.username,
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            is_superuser=first,
            role=UserRole.ADMIN.value if first else UserRole.MEMBER.value,
        )
        return await self.users.add(user)

    async def authenticate(self, login: str, password: str) -> User:
        user = await self.users.get_by_login(login)
        if user is None or not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Incorrect username or password")
        if not user.is_active:
            raise UnauthorizedError("Account is disabled")
        return user

    def issue_tokens(self, user: User) -> Token:
        extra = {"username": user.username, "role": user.role}
        return Token(
            access_token=create_access_token(user.id, extra),
            refresh_token=create_refresh_token(user.id),
        )

    async def refresh(self, refresh_token: str) -> Token:
        try:
            payload = decode_token(refresh_token, expected_type="refresh")
            import uuid

            user_id = uuid.UUID(payload["sub"])
        except (jwt.PyJWTError, KeyError, ValueError) as exc:
            raise UnauthorizedError("Invalid refresh token") from exc

        user = await self.users.get(user_id)
        if user is None or not user.is_active:
            raise UnauthorizedError("User not found or disabled")
        return self.issue_tokens(user)
