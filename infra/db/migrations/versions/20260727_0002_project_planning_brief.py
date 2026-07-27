"""Store the current planning brief on projects.

Revision ID: 20260727_0002
Revises: 20260724_0001
Create Date: 2026-07-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260727_0002"
down_revision = "20260724_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "requirement_draft",
            sa.Text(),
            nullable=False,
            server_default="",
        ),
    )
    op.add_column(
        "projects",
        sa.Column(
            "planning_brief",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "projects",
        sa.Column("selected_model", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projects", "selected_model")
    op.drop_column("projects", "planning_brief")
    op.drop_column("projects", "requirement_draft")
