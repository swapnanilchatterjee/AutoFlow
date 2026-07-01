"""Synchronous run-creation helpers (used by Celery tasks / scheduler)."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import RunStatus
from app.models.workflow import StepRun, Workflow, WorkflowRun
from app.workers.parser import WorkflowParseError, parse_workflow


def _next_run_number(db: Session, workflow_id: uuid.UUID) -> int:
    res = db.execute(
        select(func.coalesce(func.max(WorkflowRun.run_number), 0)).where(
            WorkflowRun.workflow_id == workflow_id
        )
    )
    return int(res.scalar_one()) + 1


def create_run_sync(
    db: Session,
    workflow: Workflow,
    *,
    trigger: str,
    user_id: uuid.UUID | None = None,
) -> WorkflowRun | None:
    """Create a queued run + its step rows synchronously. Returns None on bad def."""
    try:
        parsed = parse_workflow(workflow.definition, default_name=workflow.name)
    except WorkflowParseError:
        return None

    run = WorkflowRun(
        workflow_id=workflow.id,
        workspace_id=workflow.workspace_id,
        run_number=_next_run_number(db, workflow.id),
        status=RunStatus.QUEUED.value,
        trigger=trigger,
        triggered_by_id=user_id,
    )
    db.add(run)
    db.flush()
    for idx, step in enumerate(parsed.steps):
        db.add(StepRun(run_id=run.id, name=step.name, step_index=idx, command=step.run))
    db.commit()
    return run


def recently_dispatched(db: Session, workflow_id: uuid.UUID, seconds: int = 55) -> bool:
    """Guard against duplicate scheduled fires within the same minute window."""
    cutoff = datetime.now(UTC) - timedelta(seconds=seconds)
    res = db.execute(
        select(WorkflowRun.id)
        .where(WorkflowRun.workflow_id == workflow_id, WorkflowRun.created_at >= cutoff)
        .limit(1)
    )
    return res.first() is not None
