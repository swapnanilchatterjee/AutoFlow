"""Secret and variable schemas (Phase 6). Secret values are write-only."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

KEY_PATTERN = r"^[A-Za-z_][A-Za-z0-9_]*$"


class SecretCreate(BaseModel):
    key: str = Field(pattern=KEY_PATTERN, max_length=128)
    value: str
    description: str | None = None


class SecretUpdate(BaseModel):
    value: str
    description: str | None = None


class SecretRead(ORMModel):
    """Never exposes the value — only metadata."""
    id: uuid.UUID
    key: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class VariableCreate(BaseModel):
    key: str = Field(pattern=KEY_PATTERN, max_length=128)
    value: str
    description: str | None = None


class VariableUpdate(BaseModel):
    value: str
    description: str | None = None


class VariableRead(ORMModel):
    id: uuid.UUID
    key: str
    value: str
    description: str | None
    created_at: datetime
