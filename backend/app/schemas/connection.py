"""Schemas for messaging connections (integrations)."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ConnectionCreate(BaseModel):
    type: str = Field(description="Channel type: gmail | telegram | whatsapp")
    name: str = Field(min_length=1, max_length=120)
    config: dict[str, str] = Field(default_factory=dict)
    enabled: bool = True


class ConnectionUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    config: dict[str, str] | None = None
    enabled: bool | None = None


class ConnectionRead(BaseModel):
    id: str
    type: str
    name: str
    enabled: bool
    # values are redacted: secret fields show "••••••" (or "" if unset)
    config_summary: dict[str, str]
    created_at: datetime
    updated_at: datetime


class ConnectionTestRequest(BaseModel):
    to: str = Field(description="A recipient to send a test message to")
    include_attachment: bool = Field(default=False, description="Whether to attach a mock report file")


class ConnectionTestResult(BaseModel):
    ok: bool
    detail: str
