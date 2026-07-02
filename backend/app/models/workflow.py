"""Workflow definition, runs and step runs (Phases 7, 9, 10)."""
import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import RunStatus, StepStatus, TriggerType
from app.models.base import Base, TimestampMixin, UUIDMixin


class Workflow(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "workflows"
    __table_args__ = (UniqueConstraint("workspace_id", "slug", name="uq_workflow_slug"),)

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # YAML workflow definition (steps, env, etc.)
    definition: Mapped[str] = mapped_column(Text, nullable=False, default="")
    trigger_type: Mapped[str] = mapped_column(
        String(20), default=TriggerType.MANUAL.value, nullable=False
    )
    schedule_cron: Mapped[str | None] = mapped_column(String(120), nullable=True)
    schedule_tz: Mapped[str | None] = mapped_column(String(60), nullable=True, default="UTC")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_on_failure: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    webhook_token: Mapped[str | None] = mapped_column(
        String(64), unique=True, index=True, nullable=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    runs: Mapped[list["WorkflowRun"]] = relationship(
        back_populates="workflow", cascade="all, delete-orphan"
    )

    @property
    def next_runs(self) -> list[str] | None:
        if self.trigger_type != "schedule" or not self.schedule_cron:
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


class WorkflowRun(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "workflow_runs"

    workflow_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    run_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=RunStatus.QUEUED.value, index=True, nullable=False
    )
    trigger: Mapped[str] = mapped_column(String(20), nullable=False)
    commit_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)
    started_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    finished_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    triggered_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    celery_task_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    workflow: Mapped["Workflow"] = relationship(back_populates="runs")
    steps: Mapped[list["StepRun"]] = relationship(
        back_populates="run", cascade="all, delete-orphan", order_by="StepRun.step_index"
    )


class StepRun(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "step_runs"

    run_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=StepStatus.PENDING.value, nullable=False
    )
    command: Mapped[str] = mapped_column(Text, nullable=False, default="")
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    finished_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    logs: Mapped[str] = mapped_column(Text, default="", nullable=False)

    run: Mapped["WorkflowRun"] = relationship(back_populates="steps")
