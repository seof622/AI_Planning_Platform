import pytest

from planning_ai import (
    GeneratedPlanningResult,
    PlanningValidationError,
    PlanningWorkflow,
)


VALID_RESULT = {
    "nodes": [
        {
            "id": "node-input",
            "type": "ui",
            "label": "입력",
            "description": "요구사항 입력",
            "category": "Web",
            "priority": "high",
        },
        {
            "id": "node-api",
            "type": "api",
            "label": "API",
            "description": "계획 생성",
            "category": "Backend",
            "priority": "high",
        },
    ],
    "edges": [
        {
            "id": "edge-input-api",
            "source": "node-input",
            "target": "node-api",
            "label": "요청",
            "dependencyType": "feeds",
        }
    ],
    "roadmap": [
        {
            "id": "step-build",
            "title": "구현",
            "description": "기능 구현",
            "order": 1,
            "priority": "high",
            "estimatedEffort": "medium",
            "dependsOn": [],
            "componentNodeIds": ["node-input", "node-api"],
        }
    ],
    "summary": "입력에서 API로 이어지는 계획입니다.",
}


class FakeProvider:
    model = "fake-model"
    prompt_version = "planning-prompt-v2"

    def __init__(self, result: dict = VALID_RESULT) -> None:
        self.result = GeneratedPlanningResult.model_validate(result)
        self.last_prompt = ""

    def generate(self, prompt: str) -> GeneratedPlanningResult:
        self.last_prompt = prompt
        return self.result


def test_workflow_returns_contract_shaped_result() -> None:
    provider = FakeProvider()
    workflow = PlanningWorkflow(provider=provider)

    result = workflow.generate({"requirement": "API 계획을 생성해 주세요."})

    assert "API 계획을 생성해 주세요." in provider.last_prompt
    assert result["metadata"]["model"] == "fake-model"
    assert result["metadata"]["promptVersion"] == "planning-prompt-v2"
    assert result["metadata"]["workflowVersion"] == "langgraph-openai-v1"
    assert result["nodes"][0]["position"] == {"x": 0, "y": 80}
    assert result["edges"][0]["target"] == "node-api"
    assert result["roadmap"][0]["componentNodeIds"] == ["node-input", "node-api"]


def test_workflow_omits_roadmap_when_requested() -> None:
    workflow = PlanningWorkflow(provider=FakeProvider())

    result = workflow.generate(
        {
            "requirement": "그래프만 생성해 주세요.",
            "options": {"includeRoadmap": False},
        }
    )

    assert result["roadmap"] == []


def test_workflow_rejects_unknown_edge_node() -> None:
    invalid_result = {
        **VALID_RESULT,
        "edges": [
            {
                **VALID_RESULT["edges"][0],
                "target": "node-missing",
            }
        ],
    }
    workflow = PlanningWorkflow(provider=FakeProvider(invalid_result))

    with pytest.raises(PlanningValidationError, match="unknown node"):
        workflow.generate({"requirement": "잘못된 그래프"})
