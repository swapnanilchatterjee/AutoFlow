"""Schemas for messaging connections (integrations)."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ConnectionCreate(BaseModel):
    type: str = Field(description="Channel type: gmail | telegram | whatsapp")
    name: str = Field(min_length=1, max_length=120)
    config: dict[str, str] = Field(default_factory=dict)
    enabled: bool = True
    schedule_cron: str | None = None
    schedule_tz: str | None = "UTC"
    schedule_to: str | None = None


class ConnectionUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    config: dict[str, str] | None = None
    enabled: bool | None = None
    schedule_cron: str | None = None
    schedule_tz: str | None = None
    schedule_to: str | None = None


class ConnectionRead(BaseModel):
    id: str
    type: str
    name: str
    enabled: bool
    # values are redacted: secret fields show "••••••" (or "" if unset)
    config_summary: dict[str, str]
    schedule_cron: str | None
    schedule_tz: str | None
    schedule_to: str | None
    next_runs: list[str] | None
    created_at: datetime
    updated_at: datetime


class ConnectionTestRequest(BaseModel):
    to: str = Field(description="A recipient to send a test message to")
    include_attachment: bool = Field(default=False, description="Whether to attach a mock report file")


class ConnectionTestResult(BaseModel):
    ok: bool
    detail: str
