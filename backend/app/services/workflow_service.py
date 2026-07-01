"""Workflow CRUD and run orchestration (Phases 7, 8, 9)."""
from __future__ import annotations

import re
import secrets as _secrets
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import RunStatus, TriggerType
from app.core.exceptions import AppException, ConflictError, NotFoundError
from app.models.workflow import StepRun, Workflow, WorkflowRun
from app.repositories.workflow import RunRepository, StepRepository, WorkflowRepository
from app.schemas.workflow import WorkflowCreate, WorkflowUpdate
from app.workers.parser import WorkflowParseError, parse_workflow


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "workflow"


class WorkflowService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = WorkflowRepository(db)
        self.runs = RunRepository(db)
        self.steps = StepRepository(db)

    async def _unique_slug(self, workspace_id: uuid.UUID, name: str) -> str:
        base = _slugify(name)
        slug = base
        i = 2
        while await self.repo.get_by_slug(workspace_id, slug):
            slug = f"{base}-{i}"
            i += 1
        return slug

    @staticmethod
    def _validate(definition: str) -> None:
        if definition and definition.strip():
            try:
                parse_workflow(definition)
            except WorkflowParseError as exc:
                raise AppException(str(exc), status_code=422) from exc

    async def list(self, workspace_id: uuid.UUID) -> list[Workflow]:
        return await self.repo.list_for_workspace(workspace_id)

    async def get(self, workspace_id: uuid.UUID, workflow_id: uuid.UUID) -> Workflow:
        wf = await self.repo.get(workflow_id)
        if wf is None or wf.workspace_id != workspace_id:
            raise NotFoundError("Workflow not found")
        return wf

    async def create(
        self, workspace_id: uuid.UUID, data: WorkflowCreate, user_id: uuid.UUID
    ) -> Workflow:
        self._validate(data.definition)
        slug = await self._unique_slug(workspace_id, data.name)
        token = (
            _secrets.token_urlsafe(24)
            if data.trigger_type == TriggerType.WEBHOOK
            else None
        )
        wf = Workflow(
            workspace_id=workspace_id,
            name=data.name,
            slug=slug,
            description=data.description,
            definition=data.definition,
            trigger_type=data.trigger_type.value,
            schedule_cron=data.schedule_cron,
            schedule_tz=data.schedule_tz or "UTC",
            enabled=data.enabled,
            webhook_token=token,
            created_by_id=user_id,
        )
        wf = await self.repo.add(wf)
        await self.db.refresh(wf)
        return wf

    async def update(
        self, wf: Workflow, data: WorkflowUpdate
    ) -> Workflow:
        if data.definition is not None:
            self._validate(data.definition)
            wf.definition = data.definition
        if data.name is not None:
            wf.name = data.name
        if data.description is not None:
            wf.description = data.description
        if data.trigger_type is not None:
            wf.trigger_type = data.trigger_type.value
            if data.trigger_type == TriggerType.WEBHOOK and not wf.webhook_token:
                wf.webhook_token = _secrets.token_urlsafe(24)
        if data.schedule_cron is not None:
            wf.schedule_cron = data.schedule_cron or None
        if data.schedule_tz is not None:
            wf.schedule_tz = data.schedule_tz or "UTC"
        if data.enabled is not None:
            wf.enabled = data.enabled
        await self.db.flush()
        await self.db.refresh(wf)
        return wf

    async def delete(self, wf: Workflow) -> None:
        await self.repo.delete(wf)

    async def regenerate_webhook(self, wf: Workflow) -> Workflow:
        wf.webhook_token = _secrets.token_urlsafe(24)
        await self.db.flush()
        return wf

    # --- runs ----------------------------------------------------------------
    async def create_run(
        self,
        wf: Workflow,
        *,
        trigger: str,
        user_id: uuid.UUID | None,
    ) -> WorkflowRun:
        if not wf.enabled:
            raise ConflictError("Workflow is disabled")
        try:
            parsed = parse_workflow(wf.definition, default_name=wf.name)
        except WorkflowParseError as exc:
            raise AppException(f"Cannot run: {exc}", status_code=422) from exc

        number = await self.runs.next_run_number(wf.id)
        run = WorkflowRun(
            workflow_id=wf.id,
            workspace_id=wf.workspace_id,
            run_number=number,
            status=RunStatus.QUEUED.value,
            trigger=trigger,
            triggered_by_id=user_id,
        )
        run = await self.runs.add(run)
        for idx, step in enumerate(parsed.steps):
            self.db.add(
                StepRun(
                    run_id=run.id, name=step.name, step_index=idx, command=step.command_display
                )
            )
        await self.db.flush()
        # Commit so the row is visible to the worker process before dispatch.
        await self.db.commit()

        from app.workers.tasks import run_workflow

        async_result = run_workflow.delay(str(run.id))
        run.celery_task_id = async_result.id
        await self.db.flush()
        await self.db.commit()
        return run

    async def list_runs(
        self, wf: Workflow, *, limit: int = 50, offset: int = 0
    ) -> list[WorkflowRun]:
        return await self.runs.list_for_workflow(wf.id, limit=limit, offset=offset)

    async def get_run(
        self, workspace_id: uuid.UUID, run_id: uuid.UUID
    ) -> WorkflowRun:
        run = await self.runs.get_with_steps(run_id)
        if run is None or run.workspace_id != workspace_id:
            raise NotFoundError("Run not found")
        return run

    async def cancel_run(self, run: WorkflowRun) -> WorkflowRun:
        if run.status in {RunStatus.SUCCESS.value, RunStatus.FAILED.value,
                          RunStatus.CANCELLED.value}:
            raise ConflictError("Run already finished")
        run.status = RunStatus.CANCELLED.value
        await self.db.flush()
        await self.db.commit()
        if run.celery_task_id:
            from app.workers.celery_app import celery_app

            celery_app.control.revoke(run.celery_task_id, terminate=True, signal="SIGKILL")
        return run
