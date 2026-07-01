"""Shared string enums (stored as VARCHAR for migration simplicity)."""
from enum import Enum


class StrEnum(str, Enum):
    def __str__(self) -> str:  # pragma: no cover
        return self.value


class UserRole(StrEnum):
    ADMIN = "admin"      # platform administrator
    MEMBER = "member"    # standard user
    VIEWER = "viewer"    # read-only


class WorkspaceRole(StrEnum):
    OWNER = "owner"
    MAINTAINER = "maintainer"
    MEMBER = "member"
    VIEWER = "viewer"


class TriggerType(StrEnum):
    MANUAL = "manual"
    SCHEDULE = "schedule"
    WEBHOOK = "webhook"


class RunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


TERMINAL_RUN_STATUSES = {RunStatus.SUCCESS, RunStatus.FAILED, RunStatus.CANCELLED}
