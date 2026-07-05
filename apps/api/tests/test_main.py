from fastapi.testclient import TestClient

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


def test_planning_generate_uses_placeholder_metadata() -> None:
    response = client.post(
        "/planning/generate",
        json={"requirement": "AI 연결 전 placeholder 결과를 반환한다."},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["metadata"]["model"] == "placeholder"
    assert body["metadata"]["workflowVersion"] == "api-skeleton-v1"


def test_empty_requirement_is_rejected() -> None:
    response = client.post("/planning/mock", json={"requirement": "   "})

    assert response.status_code == 422
