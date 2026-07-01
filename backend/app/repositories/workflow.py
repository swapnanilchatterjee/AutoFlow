"""Workflow, run and step repositories."""
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.models.workflow import StepRun, Workflow, WorkflowRun
from app.repositories.base import BaseRepository


class WorkflowRepository(BaseRepository[Workflow]):
    model = Workflow

    async def get_by_slug(self, workspace_id: uuid.UUID, slug: str) -> Workflow | None:
        res = await self.session.execute(
            select(Workflow).where(
                Workflow.workspace_id == workspace_id, Workflow.slug == slug
            )
        )
        return res.scalar_one_or_none()

    async def list_for_workspace(self, workspace_id: uuid.UUID) -> list[Workflow]:
        res = await self.session.execute(
            select(Workflow)
            .where(Workflow.workspace_id == workspace_id)
            .order_by(Workflow.created_at.desc())
        )
        return list(res.scalars().all())

    async def get_by_webhook(self, token: str) -> Workflow | None:
        res = await self.session.execute(
            select(Workflow).where(Workflow.webhook_token == token)
        )
        return res.scalar_one_or_none()

    async def list_scheduled(self) -> list[Workflow]:
        res = await self.session.execute(
            select(Workflow).where(
                Workflow.enabled.is_(True),
                Workflow.trigger_type == "schedule",
                Workflow.schedule_cron.is_not(None),
            )
        )
        return list(res.scalars().all())


class RunRepository(BaseRepository[WorkflowRun]):
    model = WorkflowRun

    async def next_run_number(self, workflow_id: uuid.UUID) -> int:
        res = await self.session.execute(
            select(func.coalesce(func.max(WorkflowRun.run_number), 0)).where(
                WorkflowRun.workflow_id == workflow_id
            )
        )
        return int(res.scalar_one()) + 1

    async def list_for_workflow(
        self, workflow_id: uuid.UUID, *, limit: int = 50, offset: int = 0
    ) -> list[WorkflowRun]:
        res = await self.session.execute(
            select(WorkflowRun)
            .where(WorkflowRun.workflow_id == workflow_id)
            .order_by(WorkflowRun.run_number.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(res.scalars().all())

    async def get_with_steps(self, run_id: uuid.UUID) -> WorkflowRun | None:
        res = await self.session.execute(
            select(WorkflowRun)
            .options(selectinload(WorkflowRun.steps))
            .where(WorkflowRun.id == run_id)
        )
        return res.scalar_one_or_none()

    async def list_for_workspace(
        self, workspace_id: uuid.UUID, *, limit: int = 20
    ) -> list[WorkflowRun]:
        res = await self.session.execute(
            select(WorkflowRun)
            .where(WorkflowRun.workspace_id == workspace_id)
            .order_by(WorkflowRun.created_at.desc())
            .limit(limit)
        )
        return list(res.scalars().all())


class StepRepository(BaseRepository[StepRun]):
    model = StepRun
