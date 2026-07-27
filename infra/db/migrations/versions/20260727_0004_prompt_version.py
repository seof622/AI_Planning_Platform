"""Track prompt versions on planning results.

Revision ID: 20260727_0004
Revises: 20260727_0003
Create Date: 2026-07-27
"""

from alembic import op
import sqlalchemy as sa


revision = "20260727_0004"
down_revision = "20260727_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "planning_results",
        sa.Column("prompt_version", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("planning_results", "prompt_version")
