"""Workspace schemas (Phase 3)."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel
from app.schemas.user import UserRead


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None


class WorkspaceRead(ORMModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    owner_id: uuid.UUID
    created_at: datetime
    role: str | None = None  # caller's role, filled by service


class MemberAdd(BaseModel):
    username: str  # email or username of an existing user
    role: str = "member"


class MemberUpdate(BaseModel):
    role: str


class MemberRead(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID
    role: str
    user: UserRead
