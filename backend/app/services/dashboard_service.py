"""Dashboard aggregate statistics (Phase 12)."""
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import RunStatus
from app.models.workflow import Workflow, WorkflowRun
from app.models.workspace import Workspace, WorkspaceMember
from app.schemas.dashboard import DashboardStats, RecentRun, StatusCount


class DashboardService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _workspace_ids(self, user_id: uuid.UUID, is_superuser: bool) -> list[uuid.UUID]:
        if is_superuser:
            res = await self.db.execute(select(Workspace.id))
            return list(res.scalars().all())
        res = await self.db.execute(
            select(WorkspaceMember.workspace_id).where(WorkspaceMember.user_id == user_id)
        )
        return list(res.scalars().all())

    async def stats(self, user_id: uuid.UUID, is_superuser: bool) -> DashboardStats:
        ws_ids = await self._workspace_ids(user_id, is_superuser)
        if not ws_ids:
            return DashboardStats(
                workspaces=0, workflows=0, total_runs=0,
                runs_by_status=[], success_rate=0.0, recent_runs=[],
            )

        wf_count = int(
            (
                await self.db.execute(
                    select(func.count())
                    .select_from(Workflow)
                    .where(Workflow.workspace_id.in_(ws_ids))
                )
            ).scalar_one()
        )

        status_rows = (
            await self.db.execute(
                select(WorkflowRun.status, func.count())
                .where(WorkflowRun.workspace_id.in_(ws_ids))
                .group_by(WorkflowRun.status)
            )
        ).all()
        by_status = [StatusCount(status=s, count=int(c)) for s, c in status_rows]
        total_runs = sum(sc.count for sc in by_status)
        success = next(
            (sc.count for sc in by_status if sc.status == RunStatus.SUCCESS.value), 0
        )
        finished = sum(
            sc.count
            for sc in by_status
            if sc.status in {RunStatus.SUCCESS.value, RunStatus.FAILED.value}
        )
        success_rate = round((success / finished) * 100, 1) if finished else 0.0

        recent_rows = (
            await self.db.execute(
                select(WorkflowRun, Workflow.name, Workspace.slug)
                .join(Workflow, Workflow.id == WorkflowRun.workflow_id)
                .join(Workspace, Workspace.id == WorkflowRun.workspace_id)
                .where(WorkflowRun.workspace_id.in_(ws_ids))
                .order_by(WorkflowRun.created_at.desc())
                .limit(10)
            )
        ).all()
        recent = [
            RecentRun(
                id=str(run.id),
                workflow_id=str(run.workflow_id),
                workspace_id=str(run.workspace_id),
                workflow_name=wf_name,
                workspace_slug=ws_slug,
                status=run.status,
                run_number=run.run_number,
                created_at=run.created_at.isoformat(),
            )
            for run, wf_name, ws_slug in recent_rows
        ]

        return DashboardStats(
            workspaces=len(ws_ids),
            workflows=wf_count,
            total_runs=total_runs,
            runs_by_status=by_status,
            success_rate=success_rate,
            recent_runs=recent,
        )
