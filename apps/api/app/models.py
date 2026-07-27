from datetime import datetime, timezone
import uuid
from typing import Any

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
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
