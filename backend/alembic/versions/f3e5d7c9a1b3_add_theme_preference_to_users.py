"""add_theme_preference_to_users

Revision ID: f3e5d7c9a1b3
Revises: f2c3e4d5a6b7
Create Date: 2026-07-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3e5d7c9a1b3'
down_revision: Union[str, None] = 'f2c3e4d5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('theme_preference', sa.String(10), nullable=True, server_default='system'))


def downgrade() -> None:
    op.drop_column('users', 'theme_preference')
