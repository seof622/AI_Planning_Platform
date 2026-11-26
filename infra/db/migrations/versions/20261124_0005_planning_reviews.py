"""Persist input reviews, decisions, AI executions and quality feedback."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261124_0005"
down_revision = "20260727_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    document = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
    op.add_column("projects", sa.Column("input_revision", sa.Integer, nullable=False, server_default="0"))
    op.add_column("projects", sa.Column("model_revision", sa.Integer, nullable=False, server_default="0"))
    op.create_table(
        "planning_reviews",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("project_id", sa.String(64), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_review_id", sa.String(64), sa.ForeignKey("planning_reviews.id")),
        sa.Column("input_hash", sa.String(64), nullable=False),
        sa.Column("input_revision", sa.Integer, nullable=False),
        sa.Column("input_snapshot", document, nullable=False),
        sa.Column("feedback", document), sa.Column("recommendation", document),
        sa.Column("prompt_version", sa.String(100), nullable=False),
        sa.Column("rubric_version", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "planning_decisions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("project_id", sa.String(64), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("review_id", sa.String(64), sa.ForeignKey("planning_reviews.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("selected_model", sa.String(100), nullable=False),
        sa.Column("request_key", sa.String(100), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("snapshot", document, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "request_key", name="uq_planning_decision_key"),
    )
    op.create_table(
        "ai_execution_runs",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("project_id", sa.String(64), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("review_id", sa.String(64), sa.ForeignKey("planning_reviews.id", ondelete="CASCADE")),
        sa.Column("confirmation_id", sa.String(64), sa.ForeignKey("planning_decisions.id", ondelete="CASCADE")),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("request_key", sa.String(100), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("requested_model", sa.String(100), nullable=False),
        sa.Column("resolved_model", sa.String(100)), sa.Column("usage", document),
        sa.Column("estimated_cost", sa.Float), sa.Column("rate_version", sa.String(100)),
        sa.Column("error_code", sa.String(100)), sa.Column("error_message", sa.Text),
        sa.Column("result_id", sa.String(64), sa.ForeignKey("planning_results.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True)), sa.Column("elapsed_ms", sa.Integer),
        sa.UniqueConstraint("project_id", "kind", "request_key", name="uq_ai_execution_key"),
    )
    op.create_index("uq_ai_confirmation_active", "ai_execution_runs", ["confirmation_id"], unique=True,
                    postgresql_where=sa.text("status IN ('running', 'succeeded') AND confirmation_id IS NOT NULL"),
                    sqlite_where=sa.text("status IN ('running', 'succeeded') AND confirmation_id IS NOT NULL"))
    op.create_table(
        "planning_quality_evaluations",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("project_id", sa.String(64), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("result_id", sa.String(64), sa.ForeignKey("planning_results.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("criteria_version", sa.String(100), nullable=False),
        sa.Column("rating", sa.Integer, nullable=False), sa.Column("comment", sa.Text, nullable=False),
        sa.Column("request_key", sa.String(100), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "request_key", name="uq_planning_quality_key"),
    )
    for table, columns in {
        "planning_reviews": ["project_id"], "planning_decisions": ["project_id", "review_id"],
        "ai_execution_runs": ["project_id", "review_id", "confirmation_id"],
        "planning_quality_evaluations": ["project_id", "result_id"],
    }.items():
        for column in columns:
            op.create_index(f"ix_{table}_{column}", table, [column])


def downgrade() -> None:
    for table in ["planning_quality_evaluations", "ai_execution_runs", "planning_decisions", "planning_reviews"]:
        op.drop_table(table)
    op.drop_column("projects", "model_revision")
    op.drop_column("projects", "input_revision")
