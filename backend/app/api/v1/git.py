"""Workspace Git endpoints (Phase 5)."""
from fastapi import APIRouter, Depends

from app.api.deps import WorkspaceContext, get_workspace_ctx, require_workspace_role
from app.core.enums import WorkspaceRole
from app.schemas.git import (
    BranchInfo,
    CommitInfo,
    CommitRequest,
    CreateBranchRequest,
    GitStatus,
    StageRequest,
)
from app.services.git_service import GitService

router = APIRouter(prefix="/workspaces/{workspace_id}/git", tags=["git"])


@router.get("/status", response_model=GitStatus)
async def status(ctx: WorkspaceContext = Depends(get_workspace_ctx)) -> GitStatus:
    return GitService(ctx.workspace.id).status()


@router.post("/init", response_model=GitStatus, status_code=201)
async def init(
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MEMBER)),
) -> GitStatus:
    return GitService(ctx.workspace.id).init()


@router.post("/stage", response_model=GitStatus)
async def stage(
    data: StageRequest,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MEMBER)),
) -> GitStatus:
    return GitService(ctx.workspace.id).stage(data.paths)


@router.post("/commit", response_model=CommitInfo)
async def commit(
    data: CommitRequest,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MEMBER)),
) -> CommitInfo:
    return GitService(ctx.workspace.id).commit(
        data.message,
        add_all=data.add_all,
        author_name=data.author_name,
        author_email=data.author_email,
    )


@router.get("/log", response_model=list[CommitInfo])
async def log(
    limit: int = 50,
    ctx: WorkspaceContext = Depends(get_workspace_ctx),
) -> list[CommitInfo]:
    return GitService(ctx.workspace.id).log(limit)


@router.get("/branches", response_model=list[BranchInfo])
async def branches(
    ctx: WorkspaceContext = Depends(get_workspace_ctx),
) -> list[BranchInfo]:
    return GitService(ctx.workspace.id).branches()


@router.post("/branches", response_model=list[BranchInfo], status_code=201)
async def create_branch(
    data: CreateBranchRequest,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MEMBER)),
) -> list[BranchInfo]:
    return GitService(ctx.workspace.id).create_branch(data.name, data.checkout)


@router.post("/checkout", response_model=GitStatus)
async def checkout(
    name: str,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MEMBER)),
) -> GitStatus:
    return GitService(ctx.workspace.id).checkout(name)


@router.get("/diff")
async def diff(
    staged: bool = False,
    ctx: WorkspaceContext = Depends(get_workspace_ctx),
) -> dict:
    return {"diff": GitService(ctx.workspace.id).diff(staged)}
