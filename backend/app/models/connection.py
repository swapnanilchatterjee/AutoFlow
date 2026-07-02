"""Encrypted messaging connections (integrations).

A connection stores the credentials for one channel (Gmail / Telegram /
WhatsApp) for a workspace. The whole config blob is JSON, encrypted at rest
with the same Fernet key used for secrets. Secret fields are never returned.
"""
import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class Connection(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "connections"
    __table_args__ = (
        UniqueConstraint("workspace_id", "name", name="uq_connection_name"),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    config_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    schedule_cron: Mapped[str | None] = mapped_column(String(120), nullable=True)
    schedule_tz: Mapped[str | None] = mapped_column(String(60), nullable=True, default="UTC")
    schedule_to: Mapped[str | None] = mapped_column(String(255), nullable=True)

    @property
    def next_runs(self) -> list[str] | None:
        if not self.schedule_cron:
            return None
        from datetime import datetime, UTC
        from zoneinfo import ZoneInfo
        from croniter import croniter
        try:
            tz = ZoneInfo(self.schedule_tz or "UTC")
        except Exception:
            tz = UTC
        now = datetime.now(tz)
        try:
            iter = croniter(self.schedule_cron, now)
            runs = []
            for _ in range(5):
                runs.append(iter.get_next(datetime).isoformat())
            return runs
        except Exception:
            return None
