from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    PlanningResultModel,
    ProjectModel,
    RequirementModel,
    new_id,
    utc_now,
)


def to_iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def serialize_project(project: ProjectModel) -> dict[str, Any]:
    return {
        "id": project.id,
        "title": project.title,
        "description": project.description,
        "status": project.status,
        "createdAt": to_iso(project.created_at),
        "updatedAt": to_iso(project.updated_at),
    }


def create_project(
    session: Session, *, title: str, description: str
) -> ProjectModel:
    project = ProjectModel(
        id=new_id("project"),
        title=title.strip(),
        description=description.strip(),
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def list_projects(session: Session) -> list[ProjectModel]:
    statement = select(ProjectModel).order_by(ProjectModel.updated_at.desc())
    return list(session.scalars(statement))


def get_project(session: Session, project_id: str) -> ProjectModel | None:
    return session.get(ProjectModel, project_id)


def serialize_project_planning_brief(project: ProjectModel) -> dict[str, Any] | None:
    if project.planning_brief is None:
        return None
    return {
        "requirement": project.requirement_draft,
        "brief": project.planning_brief,
        "selectedModel": project.selected_model,
    }


def save_project_planning_brief(
    session: Session,
    *,
    project: ProjectModel,
    requirement: str,
    brief: dict[str, Any],
    selected_model: str | None,
) -> dict[str, Any]:
    project.requirement_draft = requirement
    project.planning_brief = brief
    project.selected_model = selected_model
    project.updated_at = utc_now()
    session.commit()
    session.refresh(project)
    return serialize_project_planning_brief(project) or {}


def save_planning_result(
    session: Session,
    *,
    project: ProjectModel,
    requirement_content: str,
    planning_brief: dict[str, Any] | None,
    selected_model: str | None,
    result: dict[str, Any],
) -> dict[str, Any]:
    now = utc_now()
    requirement = RequirementModel(
        id=new_id("requirement"),
        project_id=project.id,
        content=requirement_content.strip(),
        source="user",
        priority="high",
        created_at=now,
        updated_at=now,
    )

    project.status = "generated"
    project.requirement_draft = requirement_content
    project.planning_brief = planning_brief
    project.selected_model = selected_model
    project.updated_at = now
    project_record = serialize_project(project)
    requirement_record = {
        "id": requirement.id,
        "projectId": project.id,
        "content": requirement.content,
        "source": requirement.source,
        "priority": requirement.priority,
        "createdAt": to_iso(now),
        "updatedAt": to_iso(now),
    }
    persisted_result = {
        **result,
        "project": project_record,
        "requirement": requirement_record,
    }
    metadata = persisted_result.get("metadata") or {}
    stored_result = PlanningResultModel(
        id=new_id("planning-result"),
        project_id=project.id,
        requirement_id=requirement.id,
        result=persisted_result,
        model=metadata.get("model"),
        workflow_version=metadata.get("workflowVersion"),
        created_at=now,
    )
    session.add_all([requirement, stored_result])
    session.commit()
    return persisted_result


def get_latest_planning_result(
    session: Session, project_id: str
) -> dict[str, Any] | None:
    statement = (
        select(PlanningResultModel)
        .where(PlanningResultModel.project_id == project_id)
        .order_by(PlanningResultModel.created_at.desc())
        .limit(1)
    )
    stored_result = session.scalar(statement)
    return stored_result.result if stored_result else None
