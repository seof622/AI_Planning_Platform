from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.main as main_module
from app.database import Base, get_db_session
from app.main import app


GENERATED_RESULT = {
    "nodes": [
        {
            "id": "node-api",
            "type": "api",
            "label": "계획 API",
            "description": "계획을 생성합니다.",
            "category": "Backend",
            "priority": "high",
            "position": {"x": 0, "y": 80},
        }
    ],
    "edges": [],
    "roadmap": [
        {
            "id": "step-api",
            "title": "API 구현",
            "description": "계획 API를 구현합니다.",
            "order": 1,
            "priority": "high",
            "estimatedEffort": "medium",
            "dependsOn": [],
            "componentNodeIds": ["node-api"],
        }
    ],
    "summary": "API 구현 계획",
    "metadata": {
        "generatedAt": "2026-07-24T00:00:00Z",
        "model": "test-model",
        "promptVersion": "test-prompt",
        "workflowVersion": "test-workflow",
    },
}


class FakeWorkflow:
    def generate(self, request: dict) -> dict:
        assert request["requirement"]
        return GENERATED_RESULT


def test_project_planning_result_round_trip(monkeypatch) -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(
        bind=engine,
        autoflush=False,
        expire_on_commit=False,
    )

    def override_session() -> Generator[Session, None, None]:
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_session
    monkeypatch.setattr(
        main_module,
        "get_planning_workflow",
        lambda _: FakeWorkflow(),
    )

    try:
        client = TestClient(app)
        create_response = client.post(
            "/projects",
            json={
                "title": "저장 테스트 프로젝트",
                "description": "계획 결과 round trip 검증",
            },
        )
        assert create_response.status_code == 201
        project = create_response.json()
        assert project["status"] == "draft"

        brief_payload = {
            "requirement": "저장 가능한 계획을 생성해 주세요.",
            "brief": {
                "actionItems": [
                    {"title": "DB 저장 검증", "necessity": "required"}
                ],
                "context": ["FastAPI 프로젝트"],
                "planType": "project",
                "successCriterion": "quality",
                "constraints": "SQLite 테스트에서 검증",
            },
            "selectedModel": "gpt-5-mini",
        }
        save_brief_response = client.put(
            f"/projects/{project['id']}/planning-brief",
            json=brief_payload,
        )
        assert save_brief_response.status_code == 200
        assert save_brief_response.json() == brief_payload

        get_brief_response = client.get(
            f"/projects/{project['id']}/planning-brief"
        )
        assert get_brief_response.status_code == 200
        assert get_brief_response.json() == brief_payload

        generate_response = client.post(
            f"/projects/{project['id']}/planning/generate",
            json={
                "requirement": brief_payload["requirement"],
                "brief": brief_payload["brief"],
                "options": {"model": brief_payload["selectedModel"]},
            },
        )
        assert generate_response.status_code == 200
        generated = generate_response.json()
        assert generated["project"]["status"] == "generated"
        assert generated["requirement"]["content"] == (
            "저장 가능한 계획을 생성해 주세요."
        )

        latest_response = client.get(
            f"/projects/{project['id']}/planning-results/latest"
        )
        assert latest_response.status_code == 200
        assert latest_response.json() == generated

        history_response = client.get(
            f"/projects/{project['id']}/planning-results"
        )
        assert history_response.status_code == 200
        history = history_response.json()
        assert len(history) == 1
        assert history[0]["summary"] == generated["summary"]
        assert history[0]["model"] == "test-model"
        assert history[0]["promptVersion"] == "test-prompt"
        assert history[0]["canRestore"] is True

        detail_response = client.get(
            f"/projects/{project['id']}/planning-results/{history[0]['id']}"
        )
        assert detail_response.status_code == 200
        assert detail_response.json() == generated

        snapshot_response = client.get(
            f"/projects/{project['id']}/planning-results/"
            f"{history[0]['id']}/planning-brief"
        )
        assert snapshot_response.status_code == 200
        assert snapshot_response.json()["brief"] == brief_payload["brief"]
        assert snapshot_response.json()["requirement"] == brief_payload["requirement"]

        restore_response = client.post(
            f"/projects/{project['id']}/planning-results/{history[0]['id']}/restore"
        )
        assert restore_response.status_code == 200
        restored = restore_response.json()
        assert restored["planningBrief"]["requirement"] == brief_payload["requirement"]
        assert restored["planningBrief"]["brief"] == brief_payload["brief"]
        assert restored["planningBrief"]["selectedModel"] == "test-model"
        assert restored["result"]["summary"] == generated["summary"]
        assert (
            restored["result"]["metadata"]["restoredFromResultId"]
            == history[0]["id"]
        )

        restored_history_response = client.get(
            f"/projects/{project['id']}/planning-results"
        )
        restored_history = restored_history_response.json()
        assert len(restored_history) == 2
        assert restored_history[0]["restoredFromResultId"] == history[0]["id"]
        assert restored_history[0]["canRestore"] is True

        restored_brief_response = client.get(
            f"/projects/{project['id']}/planning-brief"
        )
        restored_brief = restored_brief_response.json()
        assert restored_brief["requirement"] == brief_payload["requirement"]
        assert restored_brief["brief"] == brief_payload["brief"]
        assert restored_brief["selectedModel"] == "test-model"

        list_response = client.get("/projects")
        assert list_response.status_code == 200
        assert list_response.json()[0]["id"] == project["id"]
        assert list_response.json()[0]["status"] == "generated"
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
