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


def dispatch_connections(db: Session, now: datetime) -> int:
    """Fire any scheduled connection heartbeats/checks that are due."""
    from sqlalchemy import select
    from app.models.connection import Connection
    from app.models.delivery import Delivery
    from app.integrations.base import OutboundMessage
    from app.integrations.registry import build_channel
    from app.core.crypto import decrypt
    from datetime import timedelta
    import json

    fired = 0
    connections = list(
        db.execute(
            select(Connection).where(
                Connection.enabled.is_(True),
                Connection.schedule_cron.is_not(None),
                Connection.schedule_to.is_not(None),
            )
        ).scalars()
    )
    for conn in connections:
        cron = (conn.schedule_cron or "").strip()
        if not cron or not croniter.is_valid(cron):
            continue

        tz_name = conn.schedule_tz or "UTC"
        try:
            tz = ZoneInfo(tz_name)
        except Exception:
            tz = UTC

        now_tz = now.astimezone(tz)
        prev_fire = croniter(cron, now_tz).get_prev(datetime)
        if prev_fire.tzinfo is None:
            prev_fire = prev_fire.replace(tzinfo=tz)

        window_start = now.timestamp() - SCHED_TICK_SECONDS
        if prev_fire.timestamp() < window_start:
            continue

        # Prevent double-fire
        cutoff = datetime.now(UTC) - timedelta(seconds=55)
        res = db.execute(
            select(Delivery.id)
            .where(
                Delivery.connection_name == conn.name,
                Delivery.workspace_id == conn.workspace_id,
                Delivery.created_at >= cutoff
            )
            .limit(1)
        ).first()
        if res is not None:
            continue

        try:
            config = json.loads(decrypt(conn.config_encrypted))
            channel = build_channel(conn.type, config)
            body = f"Scheduled check from connection '{conn.name}' ({conn.type}) at {now_tz.isoformat()}"
            msg = OutboundMessage(
                recipients=[conn.schedule_to],
                subject=f"Scheduled check: {conn.name}",
                body=body,
                body_format="text",
                attachments=[]
            )

            delivery = Delivery(
                workspace_id=conn.workspace_id,
                workflow_name="Connection Schedule",
                step_name=f"Scheduled check ({conn.name})",
                channel=conn.type,
                connection_name=conn.name,
                recipients=conn.schedule_to,
                recipient_count=1,
                body_format="text",
                subject=f"Scheduled check: {conn.name}",
                attachment_count=0,
                status="executing",
                started_at=datetime.now(UTC).isoformat(),
            )
            db.add(delivery)
            db.commit()

            result = channel.send(msg)

            delivery.status = "delivered" if result.ok else "failed"
            delivery.detail = result.summary
            delivery.finished_at = datetime.now(UTC).isoformat()
            db.commit()
            fired += 1
            logger.info("Connection schedule test fired successfully for %s", conn.name)
        except Exception as exc:
            logger.error("Connection schedule test failed for %s: %s", conn.name, exc)

    return fired


@celery_app.task(name="schedule.dispatch")
def dispatch_scheduled() -> int:
    """Fire any cron-scheduled workflows or connections that are due in this tick window."""
    from sqlalchemy import select

    from app.models.workflow import Workflow

    now = datetime.now(UTC)
    fired = 0
    db = SessionLocal()
    try:
        # 1. Dispatch connection schedules
        fired += dispatch_connections(db, now)

        # 2. Dispatch workflow schedules
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
