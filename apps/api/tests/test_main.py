from fastapi.testclient import TestClient

import app.main as main_module
from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_planning_models_returns_default_and_allowed_models() -> None:
    response = client.get("/planning/models")

    assert response.status_code == 200
    body = response.json()
    assert body["defaultModel"] == "gpt-5-mini"
    assert body["models"][0] == {
        "cost": "low",
        "description": "빠르고 경제적으로 계획 초안을 생성합니다.",
        "id": "gpt-5-mini",
        "label": "GPT-5 mini",
        "quality": "standard",
        "recommendedFor": "빠른 초안, 반복 탐색, 간단한 계획",
        "speed": "fast",
    }


def test_planning_mock_returns_shared_fixture_shape() -> None:
    requirement = "Return the shared mock fixture from the API."
    response = client.post(
        "/planning/mock",
        json={"requirement": requirement},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["requirement"]["content"] == requirement
    assert body["metadata"]["model"] == "mock"
    assert len(body["nodes"]) > 0
    assert len(body["roadmap"]) > 0


def test_planning_generate_uses_selected_model(monkeypatch) -> None:
    selected_models: list[str] = []

    class FakeWorkflow:
        def generate(self, request: dict) -> dict:
            assert request["requirement"] == "Return an AI workflow result."
            return {
                "nodes": [],
                "edges": [],
                "roadmap": [],
                "summary": "generated",
                "metadata": {
                    "generatedAt": "2026-07-24T00:00:00Z",
                    "model": selected_models[-1],
                    "workflowVersion": "langgraph-openai-v1",
                },
            }

    def get_fake_workflow(model: str) -> FakeWorkflow:
        selected_models.append(model)
        return FakeWorkflow()

    monkeypatch.setattr(main_module, "get_planning_workflow", get_fake_workflow)
    response = client.post(
        "/planning/generate",
        json={
            "requirement": "Return an AI workflow result.",
            "options": {"model": "gpt-5.6-luna"},
        },
    )

    assert response.status_code == 200
    assert selected_models == ["gpt-5.6-luna"]
    body = response.json()
    assert body["metadata"]["model"] == "gpt-5.6-luna"
    assert body["metadata"]["workflowVersion"] == "langgraph-openai-v1"


def test_planning_generate_uses_default_model(monkeypatch) -> None:
    selected_models: list[str] = []

    class FakeWorkflow:
        def generate(self, _: dict) -> dict:
            return {
                "nodes": [],
                "edges": [],
                "roadmap": [],
                "summary": "generated",
                "metadata": {
                    "generatedAt": "2026-07-24T00:00:00Z",
                    "model": selected_models[-1],
                },
            }

    def get_fake_workflow(model: str) -> FakeWorkflow:
        selected_models.append(model)
        return FakeWorkflow()

    monkeypatch.setattr(main_module, "get_planning_workflow", get_fake_workflow)
    response = client.post(
        "/planning/generate",
        json={"requirement": "Use the default model."},
    )

    assert response.status_code == 200
    assert selected_models == ["gpt-5-mini"]


def test_unsupported_planning_model_is_rejected_before_provider_call(
    monkeypatch,
) -> None:
    def fail_if_called(_: str) -> None:
        raise AssertionError("Provider must not be called.")

    monkeypatch.setattr(main_module, "get_planning_workflow", fail_if_called)
    response = client.post(
        "/planning/generate",
        json={
            "requirement": "Unsupported model request",
            "options": {"model": "unapproved-model"},
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == (
        "Unsupported planning model: unapproved-model."
    )


def test_empty_requirement_is_rejected() -> None:
    response = client.post("/planning/generate", json={"requirement": "   "})

    assert response.status_code == 422


def test_planning_mock_accepts_empty_requirement_for_initial_ui_load() -> None:
    response = client.post("/planning/mock", json={"requirement": "   "})

    assert response.status_code == 200
    assert response.json()["metadata"]["model"] == "mock"
