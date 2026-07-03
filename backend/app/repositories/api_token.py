import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update

from app.models.api_token import ApiToken
from app.repositories.base import BaseRepository


class ApiTokenRepository(BaseRepository[ApiToken]):
    model = ApiToken

    async def list_for_user(self, user_id: uuid.UUID) -> list[ApiToken]:
        res = await self.session.execute(
            select(ApiToken)
            .where(ApiToken.user_id == user_id)
            .order_by(ApiToken.created_at.desc())
        )
        return list(res.scalars().all())

    async def get_by_token(self, token: str) -> ApiToken | None:
        res = await self.session.execute(
            select(ApiToken).where(ApiToken.token == token)
        )
        return res.scalar_one_or_none()

    async def create(self, user_id: uuid.UUID, name: str, expires_at: datetime | None = None) -> ApiToken:
        import secrets

        token_value = secrets.token_urlsafe(48)
        instance = ApiToken(
            user_id=user_id,
            name=name,
            token=token_value,
            expires_at=expires_at,
        )
        return await self.add(instance)

    async def delete(self, token_id: uuid.UUID) -> None:
        await self.delete_by_id(token_id)

    async def touch(self, token_id: uuid.UUID) -> None:
        await self.session.execute(
            update(ApiToken)
            .where(ApiToken.id == token_id)
            .values(last_used_at=datetime.now(UTC))
        )
