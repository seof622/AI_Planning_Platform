from fastapi.testclient import TestClient

import app.main as main_module
from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_planning_mock_returns_shared_fixture_shape() -> None:
    response = client.post(
        "/planning/mock",
        json={"requirement": "API에서 같은 mock fixture를 반환한다."},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["requirement"]["content"] == "API에서 같은 mock fixture를 반환한다."
    assert body["metadata"]["model"] == "mock"
    assert len(body["nodes"]) > 0
    assert len(body["roadmap"]) > 0


def test_planning_generate_uses_ai_workflow(monkeypatch) -> None:
    class FakeWorkflow:
        def generate(self, request: dict) -> dict:
            assert request["requirement"] == "AI workflow 결과를 반환한다."
            return {
                "nodes": [],
                "edges": [],
                "roadmap": [],
                "summary": "generated",
                "metadata": {
                    "generatedAt": "2026-07-24T00:00:00Z",
                    "model": "test-model",
                    "workflowVersion": "langgraph-openai-v1",
                },
            }

    monkeypatch.setattr(main_module, "get_planning_workflow", FakeWorkflow)
    response = client.post(
        "/planning/generate",
        json={"requirement": "AI workflow 결과를 반환한다."},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["metadata"]["model"] == "test-model"
    assert body["metadata"]["workflowVersion"] == "langgraph-openai-v1"


def test_empty_requirement_is_rejected() -> None:
    response = client.post("/planning/generate", json={"requirement": "   "})

    assert response.status_code == 422


def test_planning_mock_accepts_empty_requirement_for_initial_ui_load() -> None:
    response = client.post("/planning/mock", json={"requirement": "   "})

    assert response.status_code == 200
    assert response.json()["metadata"]["model"] == "mock"
