"""Business logic for messaging connections (integrations).

Config is stored as an encrypted JSON blob. Reads return a *redacted* summary
(secret fields masked). Updates merge over the stored config so a blank secret
field means "keep the existing value".
"""
from __future__ import annotations

import json
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt, encrypt
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.integrations.base import ChannelError
from app.integrations.compose import compose_message
from app.integrations.registry import build_channel, get_channel_class
from app.models.connection import Connection
from app.repositories.connection import ConnectionRepository
from app.schemas.connection import (
    ConnectionCreate,
    ConnectionRead,
    ConnectionTestResult,
    ConnectionUpdate,
)

MASK = "••••••"


def _decrypt_config(conn: Connection) -> dict[str, str]:
    try:
        return json.loads(decrypt(conn.config_encrypted))
    except (ValueError, json.JSONDecodeError):
        return {}


def _redact(channel_type: str, config: dict[str, str]) -> dict[str, str]:
    try:
        secret_keys = get_channel_class(channel_type).secret_keys()
    except ChannelError:
        secret_keys = set()
    out: dict[str, str] = {}
    for k, v in config.items():
        out[k] = (MASK if v else "") if k in secret_keys else v
    return out


def _to_read(conn: Connection) -> ConnectionRead:
    return ConnectionRead(
        id=str(conn.id),
        type=conn.type,
        name=conn.name,
        enabled=conn.enabled,
        config_summary=_redact(conn.type, _decrypt_config(conn)),
        schedule_cron=conn.schedule_cron,
        schedule_tz=conn.schedule_tz,
        schedule_to=conn.schedule_to,
        next_runs=conn.next_runs,
        created_at=conn.created_at,
        updated_at=conn.updated_at,
    )


class ConnectionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = ConnectionRepository(db)

    async def list(self, workspace_id: uuid.UUID) -> list[ConnectionRead]:
        return [_to_read(c) for c in await self.repo.list_for_workspace(workspace_id)]

    async def _get(self, workspace_id: uuid.UUID, connection_id: uuid.UUID) -> Connection:
        conn = await self.repo.get(connection_id)
        if conn is None or conn.workspace_id != workspace_id:
            raise NotFoundError("Connection not found")
        return conn

    async def create(self, workspace_id: uuid.UUID, data: ConnectionCreate) -> ConnectionRead:
        try:
            get_channel_class(data.type)
        except ChannelError as exc:
            raise ValidationError(str(exc)) from exc
        if await self.repo.get_by_name(workspace_id, data.name):
            raise ConflictError(f"A connection named '{data.name}' already exists")
        try:
            build_channel(data.type, data.config)  # validates required fields
        except ChannelError as exc:
            raise ValidationError(str(exc)) from exc
        conn = Connection(
            workspace_id=workspace_id,
            type=data.type,
            name=data.name,
            config_encrypted=encrypt(json.dumps(data.config)),
            enabled=data.enabled,
            schedule_cron=data.schedule_cron or None,
            schedule_tz=data.schedule_tz or "UTC",
            schedule_to=data.schedule_to or None,
        )
        await self.repo.add(conn)
        return _to_read(conn)

    async def update(
        self, workspace_id: uuid.UUID, connection_id: uuid.UUID, data: ConnectionUpdate
    ) -> ConnectionRead:
        conn = await self._get(workspace_id, connection_id)
        if data.name is not None and data.name != conn.name:
            if await self.repo.get_by_name(workspace_id, data.name):
                raise ConflictError(f"A connection named '{data.name}' already exists")
            conn.name = data.name
        if data.enabled is not None:
            conn.enabled = data.enabled
        if data.schedule_cron is not None:
            conn.schedule_cron = data.schedule_cron or None
        if data.schedule_tz is not None:
            conn.schedule_tz = data.schedule_tz or "UTC"
        if data.schedule_to is not None:
            conn.schedule_to = data.schedule_to or None
        if data.config is not None:
            secret_keys = get_channel_class(conn.type).secret_keys()
            merged = _decrypt_config(conn)
            for k, v in data.config.items():
                # blank secret => keep existing; blank non-secret => clear
                if k in secret_keys and v in ("", MASK):
                    continue
                merged[k] = v
            try:
                build_channel(conn.type, merged)
            except ChannelError as exc:
                raise ValidationError(str(exc)) from exc
            conn.config_encrypted = encrypt(json.dumps(merged))
        await self.db.flush()
        await self.db.refresh(conn)
        return _to_read(conn)

    async def delete(self, workspace_id: uuid.UUID, connection_id: uuid.UUID) -> None:
        conn = await self._get(workspace_id, connection_id)
        await self.repo.delete(conn)

    async def test(
        self, workspace_id: uuid.UUID, connection_id: uuid.UUID, to: str, include_attachment: bool = False
    ) -> ConnectionTestResult:
        conn = await self._get(workspace_id, connection_id)
        try:
            channel = build_channel(conn.type, _decrypt_config(conn))
            msg = compose_message(
                {"to": to, "subject": "AutoFlow test message",
                 "body": f"This is a test from the '{conn.name}' connection."},
                {}, workspace_id, conn.type
            )
            if include_attachment:
                from app.integrations.base import Attachment
                msg.attachments.append(Attachment(
                    filename="test_report.csv",
                    content=b"Date,Sales,Status\n2026-07-01,1500,Sent",
                    mime_type="text/csv"
                ))
            result = channel.send(msg)
            return ConnectionTestResult(ok=result.ok, detail=result.summary)
        except ChannelError as exc:
            return ConnectionTestResult(ok=False, detail=str(exc))
