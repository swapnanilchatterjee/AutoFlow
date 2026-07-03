import uuid
import subprocess
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.api.deps import get_current_superuser
from app.core.database import get_db
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workflow import Workflow, WorkflowRun
from app.workers.celery_app import celery_app

router = APIRouter(prefix="/admin", tags=["admin"])

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
            for worker_name in ping_res.keys():
                worker_stats = stats_res.get(worker_name, {}) if stats_res else {}
                workers_list.append({
                    "name": worker_name,
                    "status": "healthy",
                    "pid": worker_stats.get("pid"),
                    "uptime": worker_stats.get("uptime", 0),
                    "active_tasks": len(active_res.get(worker_name, [])),
                })
        else:
            workers_list.append({
                "name": "celery@autoflow-worker",
                "status": "unresponsive",
                "pid": None,
                "uptime": 0,
                "active_tasks": 0,
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
        }]

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
