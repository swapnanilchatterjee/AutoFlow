"""Encrypted secrets and plaintext variables (Phase 6).

Secret values are encrypted at rest and never returned through the API.
Both secrets and variables are exposed to workflow runs as environment
variables (see :meth:`build_env`).
"""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt, encrypt
from app.core.exceptions import ConflictError, NotFoundError
from app.models.secret import Secret, Variable
from app.repositories.secret import SecretRepository, VariableRepository
from app.schemas.secret import (
    SecretCreate,
    SecretUpdate,
    VariableCreate,
    VariableUpdate,
)


class SecretService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.secrets = SecretRepository(db)
        self.variables = VariableRepository(db)

    # --- secrets -------------------------------------------------------------
    async def list_secrets(self, workspace_id: uuid.UUID) -> list[Secret]:
        return await self.secrets.list_for_workspace(workspace_id)

    async def create_secret(self, workspace_id: uuid.UUID, data: SecretCreate) -> Secret:
        if await self.secrets.get_by_key(workspace_id, data.key):
            raise ConflictError(f"Secret '{data.key}' already exists")
        s = Secret(
            workspace_id=workspace_id,
            key=data.key,
            value_encrypted=encrypt(data.value),
            description=data.description,
        )
        return await self.secrets.add(s)

    async def update_secret(
        self, workspace_id: uuid.UUID, key: str, data: SecretUpdate
    ) -> Secret:
        s = await self.secrets.get_by_key(workspace_id, key)
        if s is None:
            raise NotFoundError("Secret not found")
        s.value_encrypted = encrypt(data.value)
        if data.description is not None:
            s.description = data.description
        await self.db.flush()
        return s

    async def delete_secret(self, workspace_id: uuid.UUID, key: str) -> None:
        s = await self.secrets.get_by_key(workspace_id, key)
        if s is None:
            raise NotFoundError("Secret not found")
        await self.secrets.delete(s)

    # --- variables -----------------------------------------------------------
    async def list_variables(self, workspace_id: uuid.UUID) -> list[Variable]:
        return await self.variables.list_for_workspace(workspace_id)

    async def create_variable(
        self, workspace_id: uuid.UUID, data: VariableCreate
    ) -> Variable:
        if await self.variables.get_by_key(workspace_id, data.key):
            raise ConflictError(f"Variable '{data.key}' already exists")
        v = Variable(
            workspace_id=workspace_id,
            key=data.key,
            value=data.value,
            description=data.description,
        )
        return await self.variables.add(v)

    async def update_variable(
        self, workspace_id: uuid.UUID, key: str, data: VariableUpdate
    ) -> Variable:
        v = await self.variables.get_by_key(workspace_id, key)
        if v is None:
            raise NotFoundError("Variable not found")
        v.value = data.value
        if data.description is not None:
            v.description = data.description
        await self.db.flush()
        return v

    async def delete_variable(self, workspace_id: uuid.UUID, key: str) -> None:
        v = await self.variables.get_by_key(workspace_id, key)
        if v is None:
            raise NotFoundError("Variable not found")
        await self.variables.delete(v)

    # --- execution support ---------------------------------------------------
    async def build_env(self, workspace_id: uuid.UUID) -> dict[str, str]:
        """Decrypt secrets + collect variables into an env mapping for runs."""
        env: dict[str, str] = {}
        for v in await self.variables.list_for_workspace(workspace_id):
            env[v.key] = v.value
        for s in await self.secrets.list_for_workspace(workspace_id):
            try:
                env[s.key] = decrypt(s.value_encrypted)
            except ValueError:
                continue  # skip undecryptable secret rather than fail the run
        return env
