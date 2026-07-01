"""Report delivery log (integrations).

One row per action-step send: which workflow/run, the channel + connection used,
the recipients, the format, and the delivery status (executing → delivered / failed).
This is the audit trail behind the Delivery log UI.
"""
import uuid

from sqlalchemy import ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class Delivery(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "deliveries"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    workflow_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("workflows.id", ondelete="SET NULL"), nullable=True
    )
    run_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=True
    )
    run_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    workflow_name: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    step_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    connection_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    recipients: Mapped[str] = mapped_column(Text, nullable=False, default="")
    recipient_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    body_format: Mapped[str] = mapped_column(String(20), nullable=False, default="text")
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    attachment_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider_refs: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    finished_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
