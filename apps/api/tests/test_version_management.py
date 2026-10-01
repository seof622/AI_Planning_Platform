from copy import deepcopy
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.main as main_module
from app.database import Base, get_db_session
from app.fixtures import load_mock_planning_result


@pytest.fixture
def version_project(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def session_override():
        with factory() as session:
            yield session

    main_module.app.dependency_overrides[get_db_session] = session_override
    monkeypatch.setattr(main_module, "get_planning_workflow", lambda _: SimpleNamespace(generate=lambda _: load_mock_planning_result()))
    try:
        with TestClient(main_module.app) as client:
            project = client.post("/projects", json={"title": "Version tests"}).json()
            prefix = f"/projects/{project['id']}/planning-results"
            result = client.post(f"/projects/{project['id']}/planning/generate", json={
                "requirement": "Version test", "options": {"model": "gpt-5-mini"},
                "brief": {"planType": "project", "successCriterion": "quality", "context": [], "actionItems": []},
            })
            assert result.status_code == 200
            head = client.get(prefix).json()[0]["id"]
            yield client, prefix, result.json(), head
    finally:
        main_module.app.dependency_overrides.clear()
        engine.dispose()


def edit(client, prefix, source, result, head):
    return client.post(f"{prefix}/{source}/edit", json={
        "nodes": result["nodes"], "roadmap": result["roadmap"], "expectedLatestResultId": head,
    })


def test_stale_edit_and_restore_do_not_create_versions(version_project):
    client, prefix, original, original_id = version_project
    draft = deepcopy(original)
    draft["nodes"][0]["label"] = "First writer"
    assert edit(client, prefix, original_id, draft, original_id).status_code == 200
    latest_id = client.get(prefix).json()[0]["id"]
    stale_edit = edit(client, prefix, original_id, original, original_id)
    stale_restore = client.post(f"{prefix}/{original_id}/restore", json={"expectedLatestResultId": original_id})
    for response in (stale_edit, stale_restore):
        assert response.status_code == 409
        assert response.json()["detail"]["code"] == "planning_version_conflict"
        assert response.json()["detail"]["latestResultId"] == latest_id
    assert len(client.get(prefix).json()) == 2
    assert client.get(f"{prefix}/latest").json()["nodes"][0]["label"] == "First writer"
    assert client.get(f"{prefix}/{original_id}").json() == original
    # An intentional historical branch can be saved only against the observed head.
    assert edit(client, prefix, original_id, original, latest_id).status_code == 200


def test_each_version_records_only_its_own_operation(version_project):
    client, prefix, original, original_id = version_project
    edited = edit(client, prefix, original_id, original, original_id).json()
    edited_id = client.get(prefix).json()[0]["id"]
    assert edited["metadata"]["editedFromResultId"] == original_id
    restored_response = client.post(f"{prefix}/{edited_id}/restore", json={"expectedLatestResultId": edited_id})
    assert restored_response.status_code == 200
    restored = restored_response.json()["result"]
    restored_id = client.get(prefix).json()[0]["id"]
    assert restored["metadata"]["restoredFromResultId"] == edited_id
    assert "editedFromResultId" not in restored["metadata"]
    edited_again = edit(client, prefix, restored_id, restored, restored_id).json()
    assert edited_again["metadata"]["editedFromResultId"] == restored_id
    assert "restoredFromResultId" not in edited_again["metadata"]
    history = client.get(prefix).json()
    assert history[0]["restoredFromResultId"] is None
    assert history[1]["editedFromResultId"] is None
