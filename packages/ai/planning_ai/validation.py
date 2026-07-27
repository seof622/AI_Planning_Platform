from datetime import datetime, timezone
from typing import Any

from .errors import PlanningValidationError
from .models import GeneratedPlanningResult


def _require_unique(values: list[str], label: str) -> None:
    if len(values) != len(set(values)):
        raise PlanningValidationError(f"Generated {label} ids must be unique.")


def normalize_planning_result(
    generated: GeneratedPlanningResult,
    *,
    model: str,
    prompt_version: str,
    include_roadmap: bool,
) -> dict[str, Any]:
    node_ids = [node.id.strip() for node in generated.nodes]
    edge_ids = [edge.id.strip() for edge in generated.edges]
    roadmap = generated.roadmap if include_roadmap else []
    step_ids = [step.id.strip() for step in roadmap]

    if not node_ids or any(not node_id for node_id in node_ids):
        raise PlanningValidationError("Generated plan must contain valid nodes.")
    if any(not edge_id for edge_id in edge_ids):
        raise PlanningValidationError("Generated edges must have valid ids.")
    if any(not step_id for step_id in step_ids):
        raise PlanningValidationError("Generated roadmap steps must have valid ids.")
    if not generated.summary.strip():
        raise PlanningValidationError("Generated plan must contain a summary.")

    _require_unique(node_ids, "node")
    _require_unique(edge_ids, "edge")
    _require_unique(step_ids, "roadmap step")

    node_id_set = set(node_ids)
    for edge in generated.edges:
        if edge.source not in node_id_set or edge.target not in node_id_set:
            raise PlanningValidationError(
                f"Edge {edge.id} references an unknown node."
            )
        if edge.source == edge.target:
            raise PlanningValidationError(
                f"Edge {edge.id} must not reference itself."
            )

    step_id_set = set(step_ids)
    orders = [step.order for step in roadmap]
    if len(orders) != len(set(orders)):
        raise PlanningValidationError("Roadmap order values must be unique.")

    for step in roadmap:
        if any(dependency not in step_id_set for dependency in step.dependsOn):
            raise PlanningValidationError(
                f"Roadmap step {step.id} references an unknown dependency."
            )
        if step.id in step.dependsOn:
            raise PlanningValidationError(
                f"Roadmap step {step.id} must not depend on itself."
            )
        if any(node_id not in node_id_set for node_id in step.componentNodeIds):
            raise PlanningValidationError(
                f"Roadmap step {step.id} references an unknown node."
            )

    nodes: list[dict[str, Any]] = []
    for index, node in enumerate(generated.nodes):
        normalized = node.model_dump()
        normalized["position"] = {
            "x": (index % 3) * 390,
            "y": (index // 3) * 250 + 80,
        }
        nodes.append(normalized)

    return {
        "nodes": nodes,
        "edges": [edge.model_dump() for edge in generated.edges],
        "roadmap": [
            step.model_dump()
            for step in sorted(roadmap, key=lambda item: item.order)
        ],
        "summary": generated.summary.strip(),
        "metadata": {
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "model": model,
            "promptVersion": prompt_version,
            "workflowVersion": "langgraph-openai-v1",
        },
    }
