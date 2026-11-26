"""Opt-in real PostgreSQL verification; creates one isolated test project, never deletes user data."""

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import os
from threading import Event
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

import app.main as main
import app.review_routes as routes
from app.database import get_db_session, get_engine
from app.fixtures import load_mock_planning_result
from conftest import example_feedback


@pytest.mark.skipif(os.getenv("PLANNING_POSTGRES_TESTS") != "1", reason="requires migrated PostgreSQL")
def test_postgres_review_round_trip_and_concurrent_generation(monkeypatch):
    factory = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    def override():
        with factory() as session:
            yield session
    main.app.dependency_overrides[get_db_session] = override
    started, release = Event(), Event()
    calls = []
    def generate(request):
        calls.append(request)
        started.set()
        assert release.wait(15)
        result = deepcopy(load_mock_planning_result())
        result["metadata"]["model"] = request["options"]["model"]
        return result
    monkeypatch.setattr(routes, "get_review_provider", lambda _: SimpleNamespace(review=lambda *_: example_feedback()))
    monkeypatch.setattr(main, "get_planning_workflow", lambda _: SimpleNamespace(generate=generate))
    try:
        with TestClient(main.app) as client:
            project = client.post("/projects", json={"title": f"Review Integration E2E {uuid4()}"}).json()
            base = f"/projects/{project['id']}"
            reviewed = client.post(f"{base}/planning-reviews", json={"idempotencyKey": str(uuid4()), "input": {
                "requirement": "직원 교육 준비", "brief": {"context": [], "actionItems": [], "planType": "project", "successCriterion": "clarity"},
            }}).json()
            assert reviewed["run"]["status"] == "succeeded"
            review = reviewed["review"]
            confirmation = client.post(f"{base}/planning-reviews/{review['id']}/decisions", json={
                "kind": "confirmation", "inputHash": review["inputHash"], "selectedModel": "gpt-5-mini",
                "acceptedAssumptions": True, "idempotencyKey": str(uuid4()),
            }).json()
            endpoint = f"{base}/planning-confirmations/{confirmation['id']}/generate"
            with ThreadPoolExecutor(max_workers=2) as executor:
                first = executor.submit(client.post, endpoint, json={"idempotencyKey": str(uuid4())})
                assert started.wait(10)
                second = executor.submit(client.post, endpoint, json={"idempotencyKey": str(uuid4())})
                duplicate = second.result(timeout=10)
                assert duplicate.status_code == 200
                assert duplicate.json()["run"]["status"] == "running"
                release.set()
                completed = first.result(timeout=10).json()
            assert completed["run"]["status"] == "succeeded"
            assert len(calls) == 1
            assert completed["result"]["metadata"]["reviewId"] == review["id"]
            assert len(client.get(f"{base}/planning-results").json()) == 1
            assert client.get(f"{base}/planning-results/latest").json() == completed["result"]
            detail = client.get(f"{base}/planning-reviews/{review['id']}").json()
            assert len(detail["runs"]) == 2 and detail["decisions"][0]["id"] == confirmation["id"]
            assert client.get(f"{base}/planning-brief").json()["requirement"] == "직원 교육 준비"
            print(f"PostgreSQL review evidence: project={project['id']}, result={completed['run']['resultId']}, generationCalls={len(calls)}")
    finally:
        release.set()
        main.app.dependency_overrides.clear()
