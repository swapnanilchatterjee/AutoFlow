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

        from app.core.config import settings
        from app.core.exceptions import AppException

        is_admin = False
        if data.admin_token:
            if settings.ADMIN_REGISTRATION_TOKEN and data.admin_token == settings.ADMIN_REGISTRATION_TOKEN:
                is_admin = True
            else:
                raise AppException("Invalid admin registration token", status_code=400)
        else:
            # Fallback to the first-user auto-admin logic if no token is provided
            is_admin = not await self.users.any_exist()

        user = User(
            email=data.email.lower(),
            username=data.username,
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            is_superuser=is_admin,
            role=UserRole.ADMIN.value if is_admin else UserRole.MEMBER.value,
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

    async def forgot_password(self, email: str) -> None:
        user = await self.users.get_by_email(email.lower())
        if not user:
            return

        import secrets
        from datetime import UTC, datetime, timedelta

        from app.core.logging import logger

        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(
            minutes=10
        )
        await self.db.flush()
        await self.db.commit()

        reset_link = f"http://localhost:5173/reset-password?token={token}"
        logger.info(
            "\n" + "=" * 80 + f"\n[PASSWORD RESET REQUEST] User: {user.username} ({user.email})\n"
            f"Reset Link: {reset_link}\n" + "=" * 80
        )

        try:
            from sqlalchemy import select

            from app.integrations.base import OutboundMessage
            from app.integrations.registry import build_channel
            from app.models.connection import Connection
            from app.services.connection_service import _decrypt_config

            stmt = select(Connection).where(
                Connection.type == "gmail", Connection.enabled.is_(True)
            )
            res = await self.db.execute(stmt)
            conn = res.scalars().first()
            if conn:
                decrypted = _decrypt_config(conn)
                channel = build_channel("gmail", decrypted)
                msg = OutboundMessage(
                    recipients=[user.email],
                    subject="Report Scheduler - Password Reset Request",
                    body=(
                        f"Hello {user.full_name or user.username},\n\n"
                        f"You requested a password reset for your Report Scheduler account.\n"
                        f"Please click the link below to reset your password. "
                        f"This link is valid for 10 minutes:\n\n"
                        f"{reset_link}\n\n"
                        f"If you did not request this, you can ignore this email.\n"
                    ),
                    body_format="text",
                    attachments=[],
                )
                channel.send(msg)
                logger.info("Sent password reset email successfully.")
        except Exception as exc:
            logger.error("Failed to send password reset email: %s", exc)

    async def reset_password(self, token: str, new_password: str) -> None:
        from datetime import UTC, datetime

        from sqlalchemy import select

        from app.core.exceptions import AppException

        stmt = select(User).where(User.password_reset_token == token)
        res = await self.db.execute(stmt)
        user = res.scalars().first()

        if not user:
            raise AppException("Invalid or expired password reset token", status_code=400)

        now = datetime.now(UTC).replace(tzinfo=None)
        if user.password_reset_expires_at is None or user.password_reset_expires_at < now:
            raise AppException("Invalid or expired password reset token", status_code=400)

        user.hashed_password = hash_password(new_password)
        user.password_reset_token = None
        user.password_reset_expires_at = None
        user.last_password_changed = now
        await self.db.flush()
        await self.db.commit()
