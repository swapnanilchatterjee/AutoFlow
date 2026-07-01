"""add deliveries table (report delivery log)

Revision ID: 0003_deliveries
Revises: 0002_connections
Create Date: 2026-06-30
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_deliveries"
down_revision: str | None = "0002_connections"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_NOW = sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "deliveries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("workspace_id", sa.Uuid(), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("workflow_id", sa.Uuid(), sa.ForeignKey("workflows.id", ondelete="SET NULL"), nullable=True),
        sa.Column("run_id", sa.Uuid(), sa.ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=True),
        sa.Column("run_number", sa.Integer(), nullable=True),
        sa.Column("workflow_name", sa.String(160), nullable=False, server_default=""),
        sa.Column("step_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("connection_name", sa.String(120), nullable=False, server_default=""),
        sa.Column("recipients", sa.Text(), nullable=False, server_default=""),
        sa.Column("recipient_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("body_format", sa.String(20), nullable=False, server_default="text"),
        sa.Column("subject", sa.String(255), nullable=True),
        sa.Column("attachment_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("provider_refs", sa.Text(), nullable=True),
        sa.Column("started_at", sa.String(40), nullable=True),
        sa.Column("finished_at", sa.String(40), nullable=True),
    )
    op.create_index("ix_deliveries_workspace_id", "deliveries", ["workspace_id"])
    op.create_index("ix_deliveries_status", "deliveries", ["status"])


def downgrade() -> None:
    op.drop_index("ix_deliveries_status", table_name="deliveries")
    op.drop_index("ix_deliveries_workspace_id", table_name="deliveries")
    op.drop_table("deliveries")
