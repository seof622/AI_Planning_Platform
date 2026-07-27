"""Store planning brief snapshots for result restoration.

Revision ID: 20260727_0003
Revises: 20260727_0002
Create Date: 2026-07-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260727_0003"
down_revision = "20260727_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "planning_results",
        sa.Column(
            "planning_brief",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "planning_results",
        sa.Column(
            "restored_from_result_id",
            sa.String(length=64),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("planning_results", "restored_from_result_id")
    op.drop_column("planning_results", "planning_brief")
