"""User repository."""
from sqlalchemy import or_, select

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_email(self, email: str) -> User | None:
        res = await self.session.execute(select(User).where(User.email == email))
        return res.scalar_one_or_none()

    async def get_by_username(self, username: str) -> User | None:
        res = await self.session.execute(select(User).where(User.username == username))
        return res.scalar_one_or_none()

    async def get_by_login(self, login: str) -> User | None:
        """Resolve by email OR username (case-insensitive email)."""
        res = await self.session.execute(
            select(User).where(
                or_(User.email == login.lower(), User.username == login)
            )
        )
        return res.scalar_one_or_none()

    async def any_exist(self) -> bool:
        res = await self.session.execute(select(User.id).limit(1))
        return res.first() is not None
