from datetime import datetime, timezone
import uuid
from typing import Any

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, Integer, Float, UniqueConstraint, Index, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4()}"


class ProjectModel(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="draft")
    requirement_draft: Mapped[str] = mapped_column(Text, default="")
    planning_brief: Mapped[dict[str, Any] | None] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=True
    )
    selected_model: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    input_revision: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    model_revision: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    requirements: Mapped[list["RequirementModel"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    planning_results: Mapped[list["PlanningResultModel"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class RequirementModel(Base):
    __tablename__ = "requirements"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    content: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="user")
    priority: Mapped[str] = mapped_column(String(20), default="high")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    project: Mapped[ProjectModel] = relationship(back_populates="requirements")
    planning_results: Mapped[list["PlanningResultModel"]] = relationship(
        back_populates="requirement", cascade="all, delete-orphan"
    )


class PlanningResultModel(Base):
    __tablename__ = "planning_results"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    requirement_id: Mapped[str] = mapped_column(
        ForeignKey("requirements.id", ondelete="CASCADE"), index=True
    )
    result: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql")
    )
    planning_brief: Mapped[dict[str, Any] | None] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=True
    )
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    restored_from_result_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )
    workflow_version: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, index=True
    )

    project: Mapped[ProjectModel] = relationship(back_populates="planning_results")
    requirement: Mapped[RequirementModel] = relationship(
        back_populates="planning_results"
    )


class PlanningReviewModel(Base):
    __tablename__ = "planning_reviews"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    parent_review_id: Mapped[str | None] = mapped_column(ForeignKey("planning_reviews.id"), nullable=True)
    input_hash: Mapped[str] = mapped_column(String(64))
    input_revision: Mapped[int] = mapped_column(Integer)
    input_snapshot: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"))
    feedback: Mapped[dict | None] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    recommendation: Mapped[dict | None] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    prompt_version: Mapped[str] = mapped_column(String(100))
    rubric_version: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class PlanningDecisionModel(Base):
    __tablename__ = "planning_decisions"
    __table_args__ = (UniqueConstraint("project_id", "request_key", name="uq_planning_decision_key"),)
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    review_id: Mapped[str] = mapped_column(ForeignKey("planning_reviews.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    selected_model: Mapped[str] = mapped_column(String(100))
    request_key: Mapped[str] = mapped_column(String(100))
    request_hash: Mapped[str] = mapped_column(String(64))
    snapshot: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class AIExecutionRunModel(Base):
    __tablename__ = "ai_execution_runs"
    __table_args__ = (
        UniqueConstraint("project_id", "kind", "request_key", name="uq_ai_execution_key"),
        Index("uq_ai_confirmation_active", "confirmation_id", unique=True,
              postgresql_where=text("status IN ('running', 'succeeded') AND confirmation_id IS NOT NULL"),
              sqlite_where=text("status IN ('running', 'succeeded') AND confirmation_id IS NOT NULL")),
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    review_id: Mapped[str | None] = mapped_column(ForeignKey("planning_reviews.id", ondelete="CASCADE"), nullable=True, index=True)
    confirmation_id: Mapped[str | None] = mapped_column(ForeignKey("planning_decisions.id", ondelete="CASCADE"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(20))
    request_key: Mapped[str] = mapped_column(String(100))
    request_hash: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20), default="running")
    requested_model: Mapped[str] = mapped_column(String(100))
    resolved_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    usage: Mapped[dict | None] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    estimated_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    rate_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_id: Mapped[str | None] = mapped_column(ForeignKey("planning_results.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    elapsed_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)


class PlanningQualityEvaluationModel(Base):
    __tablename__ = "planning_quality_evaluations"
    __table_args__ = (UniqueConstraint("project_id", "request_key", name="uq_planning_quality_key"),)
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    result_id: Mapped[str] = mapped_column(ForeignKey("planning_results.id", ondelete="CASCADE"), index=True)
    source: Mapped[str] = mapped_column(String(20), default="user")
    criteria_version: Mapped[str] = mapped_column(String(100), default="user-quality-v1")
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(Text, default="")
    request_key: Mapped[str] = mapped_column(String(100))
    request_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
