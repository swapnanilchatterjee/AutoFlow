import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ApiTokenRead(ORMModel):
    id: uuid.UUID
    name: str
    token_prefix: str = ""
    last_used_at: datetime | None = None
    created_at: datetime
    expires_at: datetime | None = None


class ApiTokenCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class ApiTokenCreated(ORMModel):
    id: uuid.UUID
    name: str
    token: str
    created_at: datetime
    expires_at: datetime | None = None
