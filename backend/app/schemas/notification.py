"""Notification schemas (Phase 11)."""
import uuid
from datetime import datetime

from app.schemas.common import ORMModel


class NotificationRead(ORMModel):
    id: uuid.UUID
    title: str
    message: str
    type: str
    is_read: bool
    link: str | None
    workspace_id: uuid.UUID | None
    created_at: datetime
