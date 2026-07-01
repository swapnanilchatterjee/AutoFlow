"""Celery tasks: workflow execution + the scheduled-dispatch beat task."""
from __future__ import annotations

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from croniter import croniter

from app.core.database import SessionLocal
from app.core.logging import logger
from app.repositories.workflow import WorkflowRepository  # noqa: F401 (kept for parity)
from app.workers.celery_app import celery_app
from app.workers.executor import execute_run
from app.workers.runner import create_run_sync, recently_dispatched

SCHED_TICK_SECONDS = 60


@celery_app.task(name="health.ping")
def ping() -> str:
    """Connectivity sanity check for the worker."""
    return "pong"


@celery_app.task(name="workflow.run", bind=True)
def run_workflow(self, run_id: str) -> str:  # noqa: ANN001
    """Execute a single workflow run by id."""
    import uuid

    db = SessionLocal()
    try:
        status = execute_run(db, uuid.UUID(run_id))
        logger.info("Run %s finished: %s", run_id, status)
        return status
    finally:
        db.close()


@celery_app.task(name="schedule.dispatch")
def dispatch_scheduled() -> int:
    """Fire any cron-scheduled workflows that are due in this tick window."""
    from sqlalchemy import select

    from app.models.workflow import Workflow

    now = datetime.now(UTC)
    fired = 0
    db = SessionLocal()
    try:
        workflows = list(
            db.execute(
                select(Workflow).where(
                    Workflow.enabled.is_(True),
                    Workflow.trigger_type == "schedule",
                    Workflow.schedule_cron.is_not(None),
                )
            ).scalars()
        )
        for wf in workflows:
            cron = (wf.schedule_cron or "").strip()
            if not cron or not croniter.is_valid(cron):
                continue
            
            # Resolve target timezone
            tz_name = getattr(wf, "schedule_tz", None) or "UTC"
            try:
                tz = ZoneInfo(tz_name)
            except Exception:
                tz = UTC
            
            # Localize now to the target timezone
            now_tz = now.astimezone(tz)
            prev_fire = croniter(cron, now_tz).get_prev(datetime)
            if prev_fire.tzinfo is None:
                prev_fire = prev_fire.replace(tzinfo=tz)
                
            window_start = now.timestamp() - SCHED_TICK_SECONDS
            if prev_fire.timestamp() < window_start:
                continue
            if recently_dispatched(db, wf.id):
                continue
            run = create_run_sync(db, wf, trigger="schedule")
            if run is not None:
                run_workflow.delay(str(run.id))
                fired += 1
                logger.info("Scheduled run #%s queued for '%s'", run.run_number, wf.name)
    finally:
        db.close()
    return fired
