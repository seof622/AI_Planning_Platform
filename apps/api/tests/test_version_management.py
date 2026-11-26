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
def version_project(monkeypatch, reviewed_generate):
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
            result = reviewed_generate(client, project["id"], {
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


def test_graph_structure_changes_round_trip_without_overwriting_history(version_project):
    client, prefix, original, original_id = version_project
    draft = deepcopy(original)
    added = {**draft["nodes"][0], "id": "node-added", "label": "User node"}
    draft["nodes"].append(added)
    draft["edges"].append({
        "id": "edge-added", "source": draft["nodes"][0]["id"],
        "target": added["id"], "label": "", "dependencyType": "requires",
    })
    draft["roadmap"][0]["componentNodeIds"].append(added["id"])
    response = client.post(f"{prefix}/{original_id}/edit", json={
        "nodes": draft["nodes"], "edges": draft["edges"], "roadmap": draft["roadmap"],
        "expectedLatestResultId": original_id,
    })
    assert response.status_code == 200
    added_id = response.json()["metadata"]["resultId"]
    latest = client.get(f"{prefix}/latest").json()
    assert latest["nodes"] == draft["nodes"]
    assert latest["edges"] == draft["edges"]
    assert latest["roadmap"] == draft["roadmap"]
    removed_id = original["nodes"][0]["id"]
    draft["nodes"] = [node for node in draft["nodes"] if node["id"] != removed_id]
    draft["edges"] = [edge for edge in draft["edges"] if removed_id not in (edge["source"], edge["target"])]
    for step in draft["roadmap"]:
        step["componentNodeIds"] = [node_id for node_id in step.get("componentNodeIds", []) if node_id != removed_id]
    response = client.post(f"{prefix}/{added_id}/edit", json={
        "nodes": draft["nodes"], "edges": draft["edges"], "roadmap": draft["roadmap"],
        "expectedLatestResultId": added_id,
    })
    assert response.status_code == 200
    assert client.get(f"{prefix}/latest").json()["edges"] == draft["edges"]
    assert client.get(f"{prefix}/{original_id}").json() == original
    assert len(client.get(prefix).json()) == 3


@pytest.mark.parametrize("invalid", ["no-nodes", "node-ids", "edge-ids", "missing-endpoint", "self-edge", "duplicate-edge", "parallel-edge", "missing-roadmap-node", "nonfinite-position"])
def test_invalid_graph_changes_do_not_create_versions(version_project, invalid):
    client, prefix, original, original_id = version_project
    payload = {key: deepcopy(original[key]) for key in ("nodes", "edges", "roadmap")}
    if invalid == "no-nodes":
        payload["nodes"] = []
    elif invalid == "node-ids":
        payload["nodes"].append(deepcopy(payload["nodes"][0]))
    elif invalid == "edge-ids":
        payload["edges"].append(deepcopy(payload["edges"][0]))
    elif invalid == "missing-endpoint":
        payload["edges"][0]["target"] = "missing-node"
    elif invalid == "self-edge":
        payload["edges"][0]["target"] = payload["edges"][0]["source"]
    elif invalid == "duplicate-edge":
        payload["edges"].append({**payload["edges"][0], "id": "different-id"})
    elif invalid == "parallel-edge":
        edge = payload["edges"][0]
        payload["edges"].append({**edge, "id": "different-type", "dependencyType": "related" if edge["dependencyType"] != "related" else "feeds"})
    elif invalid == "missing-roadmap-node":
        payload["roadmap"][0]["componentNodeIds"] = ["missing-node"]
    else:
        payload["nodes"][0]["position"]["x"] = "Infinity"
    response = client.post(f"{prefix}/{original_id}/edit", json=payload)
    assert response.status_code == 422
    assert len(client.get(prefix).json()) == 1
    assert client.get(f"{prefix}/latest").json() == original


def test_roadmap_structure_and_empty_roadmap_round_trip(version_project):
    client, prefix, original, original_id = version_project
    draft = deepcopy(original)
    new_step = {
        **draft["roadmap"][0], "id": "step-added", "title": "User step",
        "order": len(draft["roadmap"]) + 1, "dependsOn": [draft["roadmap"][-1]["id"]],
        "componentNodeIds": [draft["nodes"][0]["id"]],
    }
    draft["roadmap"].append(new_step)
    response = edit(client, prefix, original_id, draft, original_id)
    assert response.status_code == 200
    added_id = response.json()["metadata"]["resultId"]
    assert client.get(f"{prefix}/latest").json()["roadmap"] == draft["roadmap"]
    removed_id = draft["roadmap"][0]["id"]
    draft["roadmap"] = [step for step in draft["roadmap"] if step["id"] != removed_id]
    for index, step in enumerate(draft["roadmap"]):
        step["order"] = index + 1
        step["dependsOn"] = [item for item in step["dependsOn"] if item != removed_id]
    draft["roadmap"][-1]["componentNodeIds"] = []
    response = edit(client, prefix, added_id, draft, added_id)
    assert response.status_code == 200
    deleted_id = response.json()["metadata"]["resultId"]
    assert client.get(f"{prefix}/latest").json()["roadmap"] == draft["roadmap"]
    draft["roadmap"] = []
    response = edit(client, prefix, deleted_id, draft, deleted_id)
    assert response.status_code == 200
    empty_id = response.json()["metadata"]["resultId"]
    assert client.get(f"{prefix}/latest").json()["roadmap"] == []
    assert client.get(f"{prefix}/{original_id}").json() == original
    restore = client.post(f"{prefix}/{original_id}/restore", json={"expectedLatestResultId": empty_id})
    assert restore.status_code == 200
    assert restore.json()["result"]["roadmap"] == original["roadmap"]
    assert len(client.get(prefix).json()) == 5


@pytest.mark.parametrize("invalid", ["duplicate-id", "order-gap", "cycle", "self", "missing-dependency", "duplicate-dependency", "duplicate-node", "missing-node", "blank-title", "blank-description"])
def test_invalid_roadmap_structure_does_not_create_versions(version_project, invalid):
    client, prefix, original, original_id = version_project
    draft = deepcopy(original)
    first, second = draft["roadmap"][:2]
    if invalid == "duplicate-id":
        second["id"] = first["id"]
    elif invalid == "order-gap":
        first["order"] = 100
    elif invalid == "cycle":
        first["dependsOn"] = [second["id"]]
        second["dependsOn"] = [first["id"]]
    elif invalid == "self":
        first["dependsOn"] = [first["id"]]
    elif invalid == "missing-dependency":
        first["dependsOn"] = ["deleted-step"]
    elif invalid == "duplicate-dependency":
        second["dependsOn"] = [first["id"], first["id"]]
    elif invalid == "duplicate-node":
        first["componentNodeIds"] = [draft["nodes"][0]["id"]] * 2
    elif invalid == "missing-node":
        first["componentNodeIds"] = ["missing-node"]
    elif invalid == "blank-title":
        first["title"] = "   "
    else:
        first["description"] = "   "
    response = edit(client, prefix, original_id, draft, original_id)
    assert response.status_code == 422
    assert len(client.get(prefix).json()) == 1
    assert client.get(f"{prefix}/latest").json() == original
