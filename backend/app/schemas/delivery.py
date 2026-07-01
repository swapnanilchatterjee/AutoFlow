"""Schemas for the report delivery log."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

# Delivery status values
EXECUTING = "executing"
DELIVERED = "delivered"
FAILED = "failed"


class DeliveryRead(BaseModel):
    id: str
    workspace_id: str
    workspace_slug: str | None = None
    workflow_id: str | None
    workflow_name: str
    run_id: str | None
    run_number: int | None
    step_name: str
    channel: str
    connection_name: str
    recipients: list[str]
    recipient_count: int
    body_format: str
    subject: str | None
    attachment_count: int
    status: str
    detail: str | None
    provider_refs: list[str]
    created_at: datetime
    started_at: str | None
    finished_at: str | None
