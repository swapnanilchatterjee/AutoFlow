"""Dashboard aggregate schemas (Phase 12)."""
from pydantic import BaseModel


class StatusCount(BaseModel):
    status: str
    count: int


class RecentRun(BaseModel):
    id: str
    workflow_id: str
    workspace_id: str
    workflow_name: str
    workspace_slug: str
    status: str
    run_number: int
    created_at: str


class DashboardStats(BaseModel):
    workspaces: int
    workflows: int
    total_runs: int
    runs_by_status: list[StatusCount]
    success_rate: float
    recent_runs: list[RecentRun]
