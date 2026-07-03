"""User schemas (Phase 2)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class UserRead(ORMModel):
    id: uuid.UUID
    email: EmailStr
    username: str
    full_name: str | None
    is_active: bool
    is_superuser: bool
    role: str
    created_at: datetime
    updated_at: datetime
    last_password_changed: datetime | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserAdminUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=64)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    full_name: str | None = None
    is_active: bool | None = None
    role: str | None = None
    is_superuser: bool | None = None

