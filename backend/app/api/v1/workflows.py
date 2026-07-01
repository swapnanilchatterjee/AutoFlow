"""Workflow, run and log endpoints (Phases 7-10)."""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import WorkspaceContext, get_workspace_ctx, require_workspace_role
from app.core.database import get_db
from app.core.enums import TriggerType, WorkspaceRole
from app.schemas.common import Message
from app.schemas.workflow import (
    TriggerRunRequest,
    WorkflowCreate,
    WorkflowRead,
    WorkflowRunDetail,
    WorkflowRunRead,
    WorkflowUpdate,
)
from app.services.workflow_service import WorkflowService

router = APIRouter(prefix="/workspaces/{workspace_id}/workflows", tags=["workflows"])


@router.get("", response_model=list[WorkflowRead])
async def list_workflows(
    ctx: WorkspaceContext = Depends(get_workspace_ctx),
    db: AsyncSession = Depends(get_db),
):
    return await WorkflowService(db).list(ctx.workspace.id)


@router.post("", response_model=WorkflowRead, status_code=201)
async def create_workflow(
    data: WorkflowCreate,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MEMBER)),
    db: AsyncSession = Depends(get_db),
):
    return await WorkflowService(db).create(ctx.workspace.id, data, ctx.member.user_id)


@router.get("/{workflow_id}", response_model=WorkflowRead)
async def get_workflow(
    workflow_id: uuid.UUID,
    ctx: WorkspaceContext = Depends(get_workspace_ctx),
    db: AsyncSession = Depends(get_db),
):
    return await WorkflowService(db).get(ctx.workspace.id, workflow_id)


@router.patch("/{workflow_id}", response_model=WorkflowRead)
async def update_workflow(
    workflow_id: uuid.UUID,
    data: WorkflowUpdate,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MEMBER)),
    db: AsyncSession = Depends(get_db),
):
    svc = WorkflowService(db)
    wf = await svc.get(ctx.workspace.id, workflow_id)
    return await svc.update(wf, data)


@router.delete("/{workflow_id}", response_model=Message)
async def delete_workflow(
    workflow_id: uuid.UUID,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MAINTAINER)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    svc = WorkflowService(db)
    wf = await svc.get(ctx.workspace.id, workflow_id)
    await svc.delete(wf)
    return Message(detail="Workflow deleted")


@router.post("/{workflow_id}/regenerate-webhook", response_model=WorkflowRead)
async def regenerate_webhook(
    workflow_id: uuid.UUID,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MAINTAINER)),
    db: AsyncSession = Depends(get_db),
):
    svc = WorkflowService(db)
    wf = await svc.get(ctx.workspace.id, workflow_id)
    return await svc.regenerate_webhook(wf)


@router.post("/{workflow_id}/trigger", response_model=WorkflowRunRead, status_code=202)
async def trigger_workflow(
    workflow_id: uuid.UUID,
    data: TriggerRunRequest | None = None,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MEMBER)),
    db: AsyncSession = Depends(get_db),
):
    svc = WorkflowService(db)
    wf = await svc.get(ctx.workspace.id, workflow_id)
    return await svc.create_run(
        wf, trigger=TriggerType.MANUAL.value, user_id=ctx.member.user_id
    )


@router.get("/{workflow_id}/runs", response_model=list[WorkflowRunRead])
async def list_runs(
    workflow_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
    ctx: WorkspaceContext = Depends(get_workspace_ctx),
    db: AsyncSession = Depends(get_db),
):
    svc = WorkflowService(db)
    wf = await svc.get(ctx.workspace.id, workflow_id)
    return await svc.list_runs(wf, limit=limit, offset=offset)


@router.get("/{workflow_id}/runs/{run_id}", response_model=WorkflowRunDetail)
async def get_run(
    workflow_id: uuid.UUID,
    run_id: uuid.UUID,
    ctx: WorkspaceContext = Depends(get_workspace_ctx),
    db: AsyncSession = Depends(get_db),
):
    return await WorkflowService(db).get_run(ctx.workspace.id, run_id)


@router.post("/{workflow_id}/runs/{run_id}/cancel", response_model=WorkflowRunRead)
async def cancel_run(
    workflow_id: uuid.UUID,
    run_id: uuid.UUID,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MEMBER)),
    db: AsyncSession = Depends(get_db),
):
    svc = WorkflowService(db)
    run = await svc.get_run(ctx.workspace.id, run_id)
    return await svc.cancel_run(run)
