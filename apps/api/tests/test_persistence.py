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
    monkeypatch.setattr(main_module, "get_planning_workflow", FakeWorkflow)

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

        generate_response = client.post(
            f"/projects/{project['id']}/planning/generate",
            json={"requirement": "저장 가능한 계획을 생성해 주세요."},
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

        list_response = client.get("/projects")
        assert list_response.status_code == 200
        assert list_response.json()[0]["id"] == project["id"]
        assert list_response.json()[0]["status"] == "generated"
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
