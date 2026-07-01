"""Workspace file-manager endpoints (Phase 4)."""
from fastapi import APIRouter, Depends, UploadFile
from fastapi import File as FileParam

from app.api.deps import WorkspaceContext, get_workspace_ctx, require_workspace_role
from app.core.enums import WorkspaceRole
from app.schemas.common import Message
from app.schemas.file import (
    CreateDirRequest,
    DirListing,
    FileContent,
    FileNode,
    RenameRequest,
    WriteFileRequest,
)
from app.services.file_service import FileService

router = APIRouter(prefix="/workspaces/{workspace_id}/files", tags=["files"])


@router.get("/tree", response_model=DirListing)
async def list_tree(
    path: str = "",
    ctx: WorkspaceContext = Depends(get_workspace_ctx),
) -> DirListing:
    return FileService(ctx.workspace.id).list_dir(path)


@router.get("/content", response_model=FileContent)
async def read_file(
    path: str,
    ctx: WorkspaceContext = Depends(get_workspace_ctx),
) -> FileContent:
    return FileService(ctx.workspace.id).read_file(path)


@router.put("/content", response_model=FileNode)
async def write_file(
    path: str,
    data: WriteFileRequest,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MEMBER)),
) -> FileNode:
    return FileService(ctx.workspace.id).write_file(path, data.content)


@router.post("/upload", response_model=FileNode)
async def upload_file(
    path: str,
    file: UploadFile = FileParam(...),
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MEMBER)),
) -> FileNode:
    raw = await file.read()
    return FileService(ctx.workspace.id).upload_file(path, raw)


@router.post("/mkdir", response_model=FileNode, status_code=201)
async def make_dir(
    data: CreateDirRequest,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MEMBER)),
) -> FileNode:
    return FileService(ctx.workspace.id).make_dir(data.path)


@router.post("/rename", response_model=FileNode)
async def rename(
    data: RenameRequest,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MEMBER)),
) -> FileNode:
    return FileService(ctx.workspace.id).rename(data.src, data.dst)


@router.delete("", response_model=Message)
async def delete_path(
    path: str,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MEMBER)),
) -> Message:
    FileService(ctx.workspace.id).delete(path)
    return Message(detail=f"Deleted {path}")
