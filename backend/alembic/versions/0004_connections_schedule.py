"""add schedule columns to connections

Revision ID: 0004_connections_schedule
Revises: 0003_deliveries
Create Date: 2026-07-02
"""
from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op

revision: str = "0004_connections_schedule"
down_revision: str | None = "0003_deliveries"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    op.add_column("connections", sa.Column("schedule_cron", sa.String(length=120), nullable=True))
    op.add_column("connections", sa.Column("schedule_tz", sa.String(length=60), nullable=True, server_default="UTC"))
    op.add_column("connections", sa.Column("schedule_to", sa.String(length=255), nullable=True))

def downgrade() -> None:
    op.drop_column("connections", "schedule_to")
    op.drop_column("connections", "schedule_tz")
    op.drop_column("connections", "schedule_cron")
