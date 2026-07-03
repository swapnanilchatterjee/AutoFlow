import uuid
import subprocess
import smtplib
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from pydantic import BaseModel, Field

from app.api.deps import get_current_superuser
from app.core.database import get_db
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workflow import Workflow, WorkflowRun, ActivityLog
from app.models.setting import AppSetting
from app.models.delivery import Delivery
from app.workers.celery_app import celery_app

router = APIRouter(prefix="/admin", tags=["admin"])


# ─────────────── SMTP Settings ───────────────

class SmtpConfig(BaseModel):
    smtp_host: str = Field("", description="SMTP server hostname")
    smtp_port: int = Field(587, description="SMTP server port")
    smtp_username: str = Field("", description="SMTP username")
    smtp_password: str = Field("", description="SMTP password")
    smtp_sender_email: str = Field("", description="Sender email address")
    smtp_sender_name: str = Field("", description="Sender display name")
    smtp_use_tls: bool = Field(True, description="Enable STARTTLS")


def _smtp_key(key: str) -> str:
    return f"smtp_{key}"


async def _get_smtp_config(db: AsyncSession) -> dict[str, str]:
    stmt = select(AppSetting).where(AppSetting.key.like("smtp_%"))
    rows = (await db.execute(stmt)).scalars().all()
    return {row.key: row.value or "" for row in rows}


async def _save_smtp_config(db: AsyncSession, cfg: SmtpConfig, hide_password: bool = False) -> dict:
    raw = cfg.model_dump()
    raw["smtp_password"] = raw.get("smtp_password") or ""
    for key, value in raw.items():
        setting_key = _smtp_key(key)
        stmt = select(AppSetting).where(AppSetting.key == setting_key)
        existing = (await db.execute(stmt)).scalars().first()
        if existing:
            existing.value = str(value)
        else:
            db.add(AppSetting(key=setting_key, value=str(value)))
    await db.flush()
    result = raw.copy()
    if hide_password:
        result["smtp_password"] = "********" if result["smtp_password"] else ""
    return result


@router.get("/settings/smtp")
async def get_smtp_settings(
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    stored = await _get_smtp_config(db)
    return {
        "smtp_host": stored.get(_smtp_key("smtp_host"), ""),
        "smtp_port": int(stored.get(_smtp_key("smtp_port"), "587")),
        "smtp_username": stored.get(_smtp_key("smtp_username"), ""),
        "smtp_password": "********" if stored.get(_smtp_key("smtp_password")) else "",
        "smtp_sender_email": stored.get(_smtp_key("smtp_sender_email"), ""),
        "smtp_sender_name": stored.get(_smtp_key("smtp_sender_name"), ""),
        "smtp_use_tls": stored.get(_smtp_key("smtp_use_tls"), "true") == "true",
    }


@router.put("/settings/smtp")
async def save_smtp_settings(
    cfg: SmtpConfig,
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    return await _save_smtp_config(db, cfg, hide_password=True)


class TestEmailRequest(BaseModel):
    to_email: str = Field(..., description="Recipient email address for the test")


@router.post("/settings/smtp/test")
async def test_smtp_connection(
    body: TestEmailRequest,
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    stored = await _get_smtp_config(db)
    host = stored.get(_smtp_key("smtp_host"), "")
    port_str = stored.get(_smtp_key("smtp_port"), "587")
    username = stored.get(_smtp_key("smtp_username"), "")
    password = stored.get(_smtp_key("smtp_password"), "")
    sender_email = stored.get(_smtp_key("smtp_sender_email"), "")
    sender_name = stored.get(_smtp_key("smtp_sender_name"), "")
    use_tls_str = stored.get(_smtp_key("smtp_use_tls"), "true")

    if not host or not username or not password or not sender_email:
        raise HTTPException(status_code=400, detail="SMTP not fully configured")

    try:
        port = int(port_str)
    except ValueError:
        port = 587

    use_tls = use_tls_str.lower() == "true"

    msg = EmailMessage()
    msg["Subject"] = "AutoFlow SMTP Test"
    from_header = f"{sender_name} <{sender_email}>" if sender_name else sender_email
    msg["From"] = from_header
    msg["To"] = body.to_email
    msg.set_content("This is a test email from AutoFlow. Your SMTP configuration is working correctly.")

    try:
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=30)
        else:
            server = smtplib.SMTP(host, port, timeout=30)
            if use_tls:
                server.ehlo()
                server.starttls()
                server.ehlo()

        with server:
            if username and password:
                server.login(username, password)
            server.send_message(msg)
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=400, detail="SMTP authentication failed. Check username and password.")
    except smtplib.SMTPRecipientsRefused:
        raise HTTPException(status_code=400, detail="Recipient was refused by the server.")
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Could not connect to SMTP server: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"SMTP test failed: {exc}")

    return {"detail": f"Test email sent successfully to {body.to_email}"}


# ─────────────── Activity Log (Global) ───────────────

@router.get("/activity")
async def get_admin_activity(
    limit: int = 50,
    offset: int = 0,
    action: str | None = None,
    user_search: str | None = None,
    entity_type: str | None = None,
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ActivityLog, User).join(User, ActivityLog.user_id == User.id)

    if action:
        stmt = stmt.where(ActivityLog.action == action)
    if entity_type:
        stmt = stmt.where(ActivityLog.entity_type == entity_type)
    if user_search:
        stmt = stmt.where(
            or_(
                User.username.ilike(f"%{user_search}%"),
                User.email.ilike(f"%{user_search}%"),
                User.full_name.ilike(f"%{user_search}%"),
            )
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.order_by(ActivityLog.created_at.desc()).offset(offset).limit(limit)
    rows = (await db.execute(stmt)).all()

    items = []
    for log, user in rows:
        items.append({
            "id": str(log.id),
            "workspace_id": str(log.workspace_id),
            "user_id": str(log.user_id),
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": str(log.entity_id),
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "user": {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
            },
        })

    return {"items": items, "total": total, "limit": limit, "offset": offset}


# ─────────────── Existing endpoints ───────────────

@router.get("/stats")
async def get_admin_stats(
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db)
):
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    total_workspaces = (await db.execute(select(func.count()).select_from(Workspace))).scalar() or 0
    total_workflows = (await db.execute(select(func.count()).select_from(Workflow))).scalar() or 0
    total_runs = (await db.execute(select(func.count()).select_from(WorkflowRun))).scalar() or 0
    
    success_runs = (await db.execute(select(func.count()).select_from(WorkflowRun).where(WorkflowRun.status == "success"))).scalar() or 0
    failed_runs = (await db.execute(select(func.count()).select_from(WorkflowRun).where(WorkflowRun.status == "failed"))).scalar() or 0
    
    return {
        "total_users": total_users,
        "total_workspaces": total_workspaces,
        "total_workflows": total_workflows,
        "total_runs": total_runs,
        "success_runs": success_runs,
        "failed_runs": failed_runs,
    }

@router.get("/workers")
async def get_workers(
    _: User = Depends(get_current_superuser)
):
    try:
        inspect = celery_app.control.inspect(timeout=2.0)
        ping_res = inspect.ping()
        stats_res = inspect.stats()
        
        workers_list = []
        if ping_res:
            active_res = inspect.active() or {}
            reserved_res = inspect.reserved() or {}
            for worker_name in ping_res.keys():
                worker_stats = stats_res.get(worker_name, {}) if stats_res else {}
                total = worker_stats.get("total", {})
                total_tasks = sum(total.values()) if total else None
                workers_list.append({
                    "name": worker_name,
                    "status": "healthy",
                    "pid": worker_stats.get("pid"),
                    "uptime": worker_stats.get("uptime", 0),
                    "active_tasks": len(active_res.get(worker_name, [])),
                    "last_heartbeat": None,
                    "total_tasks": total_tasks,
                    "memory_usage": None,
                })
        else:
            workers_list.append({
                "name": "celery@autoflow-worker",
                "status": "unresponsive",
                "pid": None,
                "uptime": 0,
                "active_tasks": 0,
                "last_heartbeat": None,
                "total_tasks": None,
                "memory_usage": None,
            })
        return workers_list
    except Exception as e:
        return [{
            "name": "celery@autoflow-worker",
            "status": "unresponsive",
            "error": str(e),
            "pid": None,
            "uptime": 0,
            "active_tasks": 0,
            "last_heartbeat": None,
            "total_tasks": None,
            "memory_usage": None,
        }]

# ─────────────── Data Retention ───────────────

class RetentionConfig(BaseModel):
    auto_delete_enabled: bool = Field(False)
    runs_value: int = Field(90, ge=1)
    runs_unit: str = Field("days")  # days, weeks, months
    logs_value: int = Field(90, ge=1)
    logs_unit: str = Field("days")


RETENTION_DEFAULTS: dict[str, str] = {
    "retention_auto_delete_enabled": "false",
    "retention_runs_value": "90",
    "retention_runs_unit": "days",
    "retention_logs_value": "90",
    "retention_logs_unit": "days",
}


def _retention_key(key: str) -> str:
    return f"retention_{key}"


async def _get_retention_config(db: AsyncSession) -> RetentionConfig:
    stmt = select(AppSetting).where(AppSetting.key.like("retention_%"))
    rows = (await db.execute(stmt)).scalars().all()
    stored = {row.key: row.value or "" for row in rows}
    cfg: dict[str, str] = {}
    for dk, dv in RETENTION_DEFAULTS.items():
        cfg[dk] = stored.get(dk, dv)
    return RetentionConfig(
        auto_delete_enabled=cfg["retention_auto_delete_enabled"] == "true",
        runs_value=int(cfg["retention_runs_value"]),
        runs_unit=cfg["retention_runs_unit"],
        logs_value=int(cfg["retention_logs_value"]),
        logs_unit=cfg["retention_logs_unit"],
    )


async def _save_retention_config(db: AsyncSession, cfg: RetentionConfig) -> RetentionConfig:
    raw = cfg.model_dump()
    for key, value in raw.items():
        setting_key = _retention_key(key)
        stmt = select(AppSetting).where(AppSetting.key == setting_key)
        existing = (await db.execute(stmt)).scalars().first()
        if existing:
            existing.value = str(value).lower() if isinstance(value, bool) else str(value)
        else:
            db.add(AppSetting(key=setting_key, value=str(value).lower() if isinstance(value, bool) else str(value)))
    await db.flush()
    return cfg


@router.get("/settings/retention")
async def get_retention_settings(
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    return await _get_retention_config(db)


@router.put("/settings/retention")
async def save_retention_settings(
    cfg: RetentionConfig,
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    return await _save_retention_config(db, cfg)


def _parse_timedelta(value: int, unit: str) -> timedelta:
    if unit == "days":
        return timedelta(days=value)
    elif unit == "weeks":
        return timedelta(weeks=value)
    elif unit == "months":
        return timedelta(days=value * 30)
    return timedelta(days=value)


@router.post("/settings/retention/run")
async def run_retention_cleanup(
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    cfg = await _get_retention_config(db)
    if not cfg.auto_delete_enabled:
        raise HTTPException(status_code=400, detail="Auto-delete is not enabled")

    runs_delta = _parse_timedelta(cfg.runs_value, cfg.runs_unit)
    logs_delta = _parse_timedelta(cfg.logs_value, cfg.logs_unit)

    cutoff_runs = datetime.now(UTC) - runs_delta
    cutoff_logs = datetime.now(UTC) - logs_delta

    deleted_runs = 0
    deleted_steps = 0
    deleted_deliveries = 0

    # Delete old WorkflowRun (cascades to StepRun)
    stmt_runs = select(WorkflowRun).where(WorkflowRun.created_at < cutoff_runs)
    old_runs = (await db.execute(stmt_runs)).scalars().all()
    for run in old_runs:
        await db.delete(run)
        deleted_runs += 1
        deleted_steps += len(run.steps) if run.steps else 0

    # Delete old Delivery records
    stmt_deliveries = select(Delivery).where(Delivery.created_at < cutoff_logs)
    old_deliveries = (await db.execute(stmt_deliveries)).scalars().all()
    for d in old_deliveries:
        await db.delete(d)
        deleted_deliveries += 1

    await db.flush()

    return {
        "detail": f"Cleanup complete: {deleted_runs} runs ({deleted_steps} steps), {deleted_deliveries} deliveries deleted.",
        "deleted_runs": deleted_runs,
        "deleted_steps": deleted_steps,
        "deleted_deliveries": deleted_deliveries,
    }


@router.post("/workers/{worker_name}/restart")
async def restart_worker(
    worker_name: str,
    _: User = Depends(get_current_superuser)
):
    try:
        celery_app.control.broadcast("pool_restart", reply=True)
        return {"detail": f"Broadcasted pool restart command to worker '{worker_name}'"}
    except Exception as e:
        return {"detail": f"Failed to restart worker: {e}"}


@router.post("/workers/{worker_name}/shutdown")
async def shutdown_worker(
    worker_name: str,
    _: User = Depends(get_current_superuser)
):
    try:
        celery_app.control.broadcast("shutdown", reply=True)
        return {"detail": f"Shutdown signal sent to worker '{worker_name}'"}
    except Exception as e:
        return {"detail": f"Failed to shutdown worker: {e}"}
