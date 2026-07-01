"""Workspace secrets & variables endpoints (Phase 6).

Secret *values* are write-only — list/read only ever returns metadata.
Variables are non-sensitive and returned in full.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import WorkspaceContext, get_workspace_ctx, require_workspace_role
from app.core.database import get_db
from app.core.enums import WorkspaceRole
from app.schemas.common import Message
from app.schemas.secret import (
    SecretCreate,
    SecretRead,
    SecretUpdate,
    VariableCreate,
    VariableRead,
    VariableUpdate,
)
from app.services.secret_service import SecretService

router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["secrets"])


# --- secrets -----------------------------------------------------------------
@router.get("/secrets", response_model=list[SecretRead])
async def list_secrets(
    ctx: WorkspaceContext = Depends(get_workspace_ctx),
    db: AsyncSession = Depends(get_db),
) -> list:
    return await SecretService(db).list_secrets(ctx.workspace.id)


@router.post("/secrets", response_model=SecretRead, status_code=201)
async def create_secret(
    data: SecretCreate,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MAINTAINER)),
    db: AsyncSession = Depends(get_db),
):
    return await SecretService(db).create_secret(ctx.workspace.id, data)


@router.put("/secrets/{key}", response_model=SecretRead)
async def update_secret(
    key: str,
    data: SecretUpdate,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MAINTAINER)),
    db: AsyncSession = Depends(get_db),
):
    return await SecretService(db).update_secret(ctx.workspace.id, key, data)


@router.delete("/secrets/{key}", response_model=Message)
async def delete_secret(
    key: str,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MAINTAINER)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    await SecretService(db).delete_secret(ctx.workspace.id, key)
    return Message(detail=f"Secret '{key}' deleted")


# --- variables ---------------------------------------------------------------
@router.get("/variables", response_model=list[VariableRead])
async def list_variables(
    ctx: WorkspaceContext = Depends(get_workspace_ctx),
    db: AsyncSession = Depends(get_db),
) -> list:
    return await SecretService(db).list_variables(ctx.workspace.id)


@router.post("/variables", response_model=VariableRead, status_code=201)
async def create_variable(
    data: VariableCreate,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MAINTAINER)),
    db: AsyncSession = Depends(get_db),
):
    return await SecretService(db).create_variable(ctx.workspace.id, data)


@router.put("/variables/{key}", response_model=VariableRead)
async def update_variable(
    key: str,
    data: VariableUpdate,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MAINTAINER)),
    db: AsyncSession = Depends(get_db),
):
    return await SecretService(db).update_variable(ctx.workspace.id, key, data)


@router.delete("/variables/{key}", response_model=Message)
async def delete_variable(
    key: str,
    ctx: WorkspaceContext = Depends(require_workspace_role(WorkspaceRole.MAINTAINER)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    await SecretService(db).delete_variable(ctx.workspace.id, key)
    return Message(detail=f"Variable '{key}' deleted")
