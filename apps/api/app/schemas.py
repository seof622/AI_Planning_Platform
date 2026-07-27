from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


ComponentNodeType = Literal[
    "feature",
    "system",
    "api",
    "data",
    "ai",
    "infra",
    "ui",
    "workflow",
]

PlanType = Literal["daily", "project", "learning", "event", "decision", "creative"]
SuccessCriterion = Literal["clarity", "speed", "balance", "quality", "consistency"]
ActionItemNecessity = Literal["required", "optional"]


class PlanningActionItem(BaseModel):
    title: str
    necessity: ActionItemNecessity


class PlanningBrief(BaseModel):
    actionItems: list[PlanningActionItem]
    context: list[str]
    planType: PlanType
    successCriterion: SuccessCriterion
    constraints: str | None = None


class PlanningProjectInput(BaseModel):
    id: str
    title: str
    description: str


class PlanningOptions(BaseModel):
    includeRoadmap: bool | None = None
    model: str | None = Field(default=None, min_length=1, max_length=100)
    preferredNodeTypes: list[ComponentNodeType] | None = None


class PlanningRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    requirement: str
    brief: PlanningBrief | None = None
    project: PlanningProjectInput | None = None
    options: PlanningOptions | None = None
    metadata: dict[str, Any] | None = None


class ProjectCreate(BaseModel):
    title: str
    description: str = ""


class ProjectPlanningBrief(BaseModel):
    requirement: str = ""
    brief: PlanningBrief
    selectedModel: str | None = Field(default=None, min_length=1, max_length=100)
