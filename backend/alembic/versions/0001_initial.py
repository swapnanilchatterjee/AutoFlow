"""initial schema — all AutoFlow tables

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-30

Creates the full schema: users, workspaces, workspace_members, secrets,
variables, workflows, workflow_runs, step_runs, notifications.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_NOW = sa.text("now()")


def _id_cols() -> list[sa.Column]:
    return [
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
    ]


def upgrade() -> None:
    # --- users ---
    op.create_table(
        "users",
        *_id_cols(),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("username", sa.String(64), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_superuser", sa.Boolean(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    # --- workspaces ---
    op.create_table(
        "workspaces",
        *_id_cols(),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("slug", sa.String(140), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "owner_id", sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
    )
    op.create_index("ix_workspaces_slug", "workspaces", ["slug"], unique=True)

    # --- workspace_members ---
    op.create_table(
        "workspace_members",
        *_id_cols(),
        sa.Column(
            "workspace_id", sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "user_id", sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("role", sa.String(20), nullable=False),
        sa.UniqueConstraint("workspace_id", "user_id", name="uq_member"),
    )

    # --- secrets ---
    op.create_table(
        "secrets",
        *_id_cols(),
        sa.Column(
            "workspace_id", sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("key", sa.String(128), nullable=False),
        sa.Column("value_encrypted", sa.Text(), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.UniqueConstraint("workspace_id", "key", name="uq_secret_key"),
    )

    # --- variables ---
    op.create_table(
        "variables",
        *_id_cols(),
        sa.Column(
            "workspace_id", sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("key", sa.String(128), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.UniqueConstraint("workspace_id", "key", name="uq_variable_key"),
    )

    # --- workflows ---
    op.create_table(
        "workflows",
        *_id_cols(),
        sa.Column(
            "workspace_id", sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("slug", sa.String(180), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("definition", sa.Text(), nullable=False),
        sa.Column("trigger_type", sa.String(20), nullable=False),
        sa.Column("schedule_cron", sa.String(120), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("webhook_token", sa.String(64), nullable=True),
        sa.Column(
            "created_by_id", sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.UniqueConstraint("workspace_id", "slug", name="uq_workflow_slug"),
    )
    op.create_index("ix_workflows_webhook_token", "workflows", ["webhook_token"], unique=True)

    # --- workflow_runs ---
    op.create_table(
        "workflow_runs",
        *_id_cols(),
        sa.Column(
            "workflow_id", sa.Uuid(),
            sa.ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "workspace_id", sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("run_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("trigger", sa.String(20), nullable=False),
        sa.Column("commit_sha", sa.String(64), nullable=True),
        sa.Column("started_at", sa.String(40), nullable=True),
        sa.Column("finished_at", sa.String(40), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "triggered_by_id", sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("celery_task_id", sa.String(64), nullable=True),
    )
    op.create_index("ix_workflow_runs_status", "workflow_runs", ["status"])

    # --- step_runs ---
    op.create_table(
        "step_runs",
        *_id_cols(),
        sa.Column(
            "run_id", sa.Uuid(),
            sa.ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("step_index", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("command", sa.Text(), nullable=False),
        sa.Column("exit_code", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.String(40), nullable=True),
        sa.Column("finished_at", sa.String(40), nullable=True),
        sa.Column("logs", sa.Text(), nullable=False),
    )

    # --- notifications ---
    op.create_table(
        "notifications",
        *_id_cols(),
        sa.Column(
            "user_id", sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False),
        sa.Column("link", sa.String(400), nullable=True),
        sa.Column(
            "workspace_id", sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True,
        ),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])


def downgrade() -> None:
    for table in (
        "notifications",
        "step_runs",
        "workflow_runs",
        "workflows",
        "variables",
        "secrets",
        "workspace_members",
        "workspaces",
        "users",
    ):
        op.drop_table(table)
