from typing import Any, Literal, TypedDict

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
DependencyType = Literal["requires", "feeds", "blocks", "related"]
Priority = Literal["low", "medium", "high"]
EffortSize = Literal["small", "medium", "large"]


class GeneratedNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    type: ComponentNodeType
    label: str
    description: str
    category: str
    priority: Priority


class GeneratedEdge(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    source: str
    target: str
    label: str
    dependencyType: DependencyType


class GeneratedRoadmapStep(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    description: str
    order: int = Field(ge=1)
    priority: Priority
    estimatedEffort: EffortSize
    dependsOn: list[str]
    componentNodeIds: list[str]


class GeneratedPlanningResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nodes: list[GeneratedNode]
    edges: list[GeneratedEdge]
    roadmap: list[GeneratedRoadmapStep]
    summary: str


class PlanningWorkflowState(TypedDict, total=False):
    request: dict[str, Any]
    prompt: str
    generated: GeneratedPlanningResult
    result: dict[str, Any]
