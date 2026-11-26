from copy import deepcopy
from types import SimpleNamespace
from uuid import uuid4

import pytest

import app.review_routes as review_routes


def example_feedback():
    return {
        "goal": "입력에 맞는 실행 계획을 만듭니다.", "clearPoints": ["계획 주제"],
        "questions": [{"field": "context", "question": "대상은 누구인가요?", "reason": "작업 범위를 정하기 위해 필요합니다."}],
        "assumptions": ["확정 날짜 대신 상대 일정을 사용합니다."], "warnings": [],
        "assessment": {axis: {"value": 2, "reason": "여러 작업의 순서를 정합니다.", "missingInformation": None}
                       for axis in ["clarity", "expertise", "reasoning", "scope"]},
    }


@pytest.fixture
def reviewed_generate(monkeypatch):
    monkeypatch.setattr(review_routes, "get_review_provider", lambda _: SimpleNamespace(
        review=lambda *_: deepcopy(example_feedback())))

    def generate(client, project_id, request):
        base = f"/projects/{project_id}"
        reviewed = client.post(f"{base}/planning-reviews", json={
            "input": {"requirement": request["requirement"], "brief": request["brief"], "preference": "balanced"},
            "idempotencyKey": str(uuid4()),
        })
        assert reviewed.status_code == 200, reviewed.text
        review = reviewed.json()["review"]
        assert reviewed.json()["run"]["status"] == "succeeded", reviewed.text
        confirmed = client.post(f"{base}/planning-reviews/{review['id']}/decisions", json={
            "kind": "confirmation", "inputHash": review["inputHash"],
            "selectedModel": request.get("options", {}).get("model", "gpt-5-mini"),
            "acceptedAssumptions": True, "idempotencyKey": str(uuid4()),
        })
        assert confirmed.status_code == 200, confirmed.text
        generated = client.post(f"{base}/planning-confirmations/{confirmed.json()['id']}/generate", json={
            "idempotencyKey": str(uuid4()),
        })
        assert generated.status_code == 200, generated.text
        assert generated.json()["run"]["status"] == "succeeded", generated.text
        # Preserve the response interface used by existing result-editing tests.
        return SimpleNamespace(status_code=200, json=lambda: generated.json()["result"])
    return generate
