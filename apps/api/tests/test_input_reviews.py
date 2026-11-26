from copy import deepcopy
from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.main as main
import app.review_routes as routes
from app.database import Base, get_db_session
from app.fixtures import load_mock_planning_result
from app.models import AIExecutionRunModel, utc_now
from app.model_recommendation import recommend_model
from app.review_repository import estimate_cost, execution_response
from app.review_schemas import ReviewInput
from planning_ai.review import InputFeedback, append_confirmed_context
from conftest import example_feedback


def key():
    return str(uuid4())


@pytest.fixture
def api(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    def override():
        with factory() as session:
            yield session
    main.app.dependency_overrides[get_db_session] = override
    calls = {"review": 0, "generation": 0, "fail": False, "request": None}
    def review(*_):
        calls["review"] += 1
        if calls["fail"]:
            raise RuntimeError("secret should never reach response")
        return example_feedback()
    def generate(request):
        calls["generation"] += 1
        calls["request"] = request
        if calls["fail"]:
            raise RuntimeError("provider failed")
        result = deepcopy(load_mock_planning_result())
        result["metadata"]["model"] = request["options"]["model"]
        return result
    monkeypatch.setattr(routes, "get_review_provider", lambda _: SimpleNamespace(review=review))
    monkeypatch.setattr(main, "get_planning_workflow", lambda _: SimpleNamespace(generate=generate))
    with TestClient(main.app) as client:
        project = client.post("/projects", json={"title": "Review tests"}).json()
        base = f"/projects/{project['id']}"
        try:
            yield client, base, calls, factory
        finally:
            main.app.dependency_overrides.clear()
            engine.dispose()


def create_review(client, base, **changes):
    payload = {"input": {"requirement": "직원 교육 준비", "brief": {
        "context": [], "actionItems": [], "planType": "project", "successCriterion": "speed",
    }}, "idempotencyKey": key()}
    payload.update(changes)
    return client.post(f"{base}/planning-reviews", json=payload), payload


def decide(client, base, review, **changes):
    payload = {"kind": "confirmation", "inputHash": review["inputHash"], "selectedModel": "gpt-5-mini",
               "acceptedAssumptions": True, "idempotencyKey": key()}
    payload.update(changes)
    return client.post(f"{base}/planning-reviews/{review['id']}/decisions", json=payload)


def test_review_confirmation_generation_history_and_quality(api):
    client, base, calls, _ = api
    response, request = create_review(client, base)
    body = response.json()
    assert response.status_code == 200 and body["run"]["status"] == "succeeded"
    assert body["run"]["usage"] is None and body["run"]["estimatedCost"] is None
    review = body["review"]
    assert review["input"]["brief"]["context"] == []  # Sparse input is valid.
    assert client.post(f"{base}/planning-reviews", json=request).json()["run"]["id"] == body["run"]["id"]
    assert calls["review"] == 1
    selected = decide(client, base, review, kind="selection", selectedModel="gpt-5.6-luna").json()
    assert selected["kind"] == "selection"
    confirmation = decide(client, base, review).json()
    endpoint = f"{base}/planning-confirmations/{confirmation['id']}/generate"
    generation_key = key()
    generated = client.post(endpoint, json={"idempotencyKey": generation_key}).json()
    assert generated["run"]["status"] == "succeeded"
    assert calls["request"]["confirmedReview"]["assumptions"] == review["feedback"]["assumptions"]
    assert review["feedback"]["assumptions"][0] in append_confirmed_context("base", calls["request"])
    for attempt_key in [generation_key, key()]:
        assert client.post(endpoint, json={"idempotencyKey": attempt_key}).json()["result"] == generated["result"]
    assert calls["generation"] == 1
    assert len(client.get(f"{base}/planning-results").json()) == 1
    detail = client.get(f"{base}/planning-reviews/{review['id']}").json()
    assert len(detail["decisions"]) == 2 and len(detail["runs"]) == 2
    assert generated["result"]["metadata"]["confirmationId"] == confirmation["id"]
    assert client.get(f"{base}/ai-execution-runs/by-key/{generation_key}?kind=generation").json() == generated
    result_id = generated["result"]["metadata"]["resultId"]
    evaluation = {"rating": 4, "comment": "가정이 명확했음", "idempotencyKey": key()}
    quality_url = f"{base}/planning-results/{result_id}/quality-evaluations"
    quality = client.post(quality_url, json=evaluation).json()
    assert quality["source"] == "user" and quality["criteriaVersion"] == "user-quality-v1"
    assert client.post(quality_url, json=evaluation).json() == quality
    assert len(client.get(quality_url).json()) == 1


@pytest.mark.parametrize("change", ["draft", "model", "new-review", "draft-reverted", "model-reverted"])
def test_stale_confirmation_cannot_generate(api, change):
    client, base, calls, _ = api
    review = create_review(client, base)[0].json()["review"]
    confirmation = decide(client, base, review).json()
    if change == "new-review":
        create_review(client, base)
    else:
        client.put(f"{base}/planning-brief", json={
            "requirement": "변경한 주제" if change.startswith("draft") else review["input"]["requirement"],
            "brief": review["input"]["brief"], "selectedModel": "gpt-5.6-luna" if change.startswith("model") else "gpt-5-mini",
        })
        if change.endswith("reverted"):
            client.put(f"{base}/planning-brief", json={"requirement": review["input"]["requirement"],
                       "brief": review["input"]["brief"], "selectedModel": "gpt-5-mini"})
    response = client.post(f"{base}/planning-confirmations/{confirmation['id']}/generate", json={"idempotencyKey": key()})
    assert response.status_code == 409
    assert calls["generation"] == 0


def test_unconfirmed_cross_project_disallowed_models_and_key_collision(api):
    client, base, calls, _ = api
    review_response, payload = create_review(client, base)
    review = review_response.json()["review"]
    assert client.post(f"{base}/planning/generate", json={"requirement": "bypass"}).status_code == 409
    assert decide(client, base, review, acceptedAssumptions=False).status_code == 422
    assert decide(client, base, review, selectedModel="unapproved").status_code == 422
    other = client.post("/projects", json={"title": "Other"}).json()["id"]
    assert decide(client, f"/projects/{other}", review).status_code == 404
    selection = decide(client, base, review, kind="selection").json()
    assert client.post(f"{base}/planning-confirmations/{selection['id']}/generate", json={"idempotencyKey": key()}).status_code == 404
    changed = deepcopy(payload)
    changed["input"]["requirement"] = "different"
    assert client.post(f"{base}/planning-reviews", json=changed).status_code == 409
    assert calls["generation"] == 0


def test_failed_review_and_generation_are_explicit_retries(api):
    client, base, calls, _ = api
    calls["fail"] = True
    failed, payload = create_review(client, base)
    assert failed.json()["run"]["status"] == "failed"
    assert "secret" not in failed.text
    assert decide(client, base, failed.json()["review"]).status_code == 409
    assert client.post(f"{base}/planning-reviews", json=payload).json()["run"]["id"] == failed.json()["run"]["id"]
    assert calls["review"] == 1
    calls["fail"] = False
    review = create_review(client, base, parentReviewId=failed.json()["review"]["id"])[0].json()["review"]
    confirmation = decide(client, base, review).json()
    endpoint = f"{base}/planning-confirmations/{confirmation['id']}/generate"
    attempt = {"idempotencyKey": key()}
    calls["fail"] = True
    assert client.post(endpoint, json=attempt).json()["run"]["status"] == "failed"
    calls["fail"] = False
    assert client.post(endpoint, json=attempt).json()["run"]["status"] == "failed"
    assert client.post(endpoint, json={"idempotencyKey": key()}).json()["run"]["status"] == "succeeded"
    assert calls["generation"] == 2


def test_interrupted_run_is_visible_without_automatic_retry(api):
    client, base, calls, factory = api
    response, _ = create_review(client, base)
    with factory() as session:
        run = session.get(AIExecutionRunModel, response.json()["run"]["id"])
        run.status = "running"
        run.created_at = utc_now() - timedelta(seconds=601)
        session.commit()
    interrupted = client.get(f"{base}/ai-execution-runs/{run.id}").json()
    assert interrupted["run"]["status"] == "interrupted" and calls["review"] == 1


def test_status_lookup_preserves_a_run_completed_after_the_initial_read(api):
    client, base, _, factory = api
    response, _ = create_review(client, base)
    run_id = response.json()["run"]["id"]
    with factory() as reader, factory() as worker:
        current = worker.get(AIExecutionRunModel, run_id)
        current.status = "running"
        current.created_at = utc_now() - timedelta(seconds=601)
        worker.commit()
        previous = reader.get(AIExecutionRunModel, run_id)
        assert previous.status == "running"
        current.status = "succeeded"
        worker.commit()
        assert execution_response(reader, previous)["run"]["status"] == "succeeded"


def test_semantic_scores_and_user_preferences_are_separate():
    feedback = example_feedback()
    feedback["assessment"]["expertise"]["value"] = 4
    snapshot = ReviewInput(requirement="분산 DB 무중단 이전", brief={
        "context": [], "actionItems": [], "planType": "project", "successCriterion": "speed",
    }).model_dump()
    recommendation = recommend_model(snapshot, feedback)
    assert recommendation["profile"] == "quality"
    assert feedback["assessment"]["expertise"]["value"] == 4
    feedback["assessment"]["expertise"] = {"value": None, "reason": "정보 부족", "missingInformation": "분야"}
    assert InputFeedback.model_validate(feedback)
    assert recommend_model(snapshot, feedback)["uncertainty"]


def test_usage_and_cost_are_never_fabricated(monkeypatch):
    assert estimate_cost("m", None) == (None, None)
    monkeypatch.setenv("PLANNING_MODEL_RATES_JSON", '{"m":{"inputPerMillion":1,"outputPerMillion":2,"version":"test"}}')
    assert estimate_cost("m", {"input_tokens": 1000, "output_tokens": 1000}) == (0.003, "test")
    assert estimate_cost("m", {"input_tokens": 1000, "output_tokens": 1000, "input_tokens_details": {"cached_tokens": 50}}) == (None, None)


@pytest.mark.parametrize("bad_value", [-1, 5, 2.5, None])
def test_invalid_assessment_is_rejected(bad_value):
    feedback = example_feedback()
    feedback["assessment"]["expertise"]["value"] = bad_value
    with pytest.raises(ValueError):
        InputFeedback.model_validate(feedback)


def test_input_normalization_and_bounds():
    input_data = {"requirement": "  직원 교육\r\n준비  ", "brief": {
        "context": [" ", " 직원 "], "actionItems": [{"title": " ", "necessity": "optional"}],
        "planType": "event", "successCriterion": "quality",
    }}
    normalized = ReviewInput.model_validate(input_data)
    assert normalized.requirement == "직원 교육\n준비"
    assert normalized.brief.context == ["직원"] and normalized.brief.actionItems == []
    with pytest.raises(ValueError):
        ReviewInput.model_validate({**input_data, "requirement": " "})
