"""Explainable, versioned routing policy. Semantic scores are not measured probabilities."""

from .config import get_openai_model_catalog

POLICY_VERSION = "planning-model-policy-v1"


def recommend_model(snapshot: dict, feedback: dict) -> dict:
    catalog = get_openai_model_catalog()
    models = catalog["models"]
    scores = feedback["assessment"]
    difficulty = [scores[axis]["value"] for axis in ("expertise", "reasoning", "scope")]
    known = [value for value in difficulty if value is not None]
    maximum = max(known, default=1)
    preference = snapshot["preference"]
    profile = "quality" if maximum >= 3 else "balanced" if maximum >= 2 else "efficient"
    if preference == "quality":
        profile = "quality"
    # User preference changes tradeoffs, never the semantic scores stored above.
    quality = {"standard": 0, "high": 1, "highest": 2}
    cost = {"low": 0, "medium": 1, "high": 2}
    speed = {"fast": 0, "balanced": 1, "deliberate": 2}

    def rank(model):
        q, c, s = quality[model["quality"]], cost[model["cost"]], speed[model["speed"]]
        target = 2 if profile == "quality" else 1 if profile == "balanced" else 0
        # With demanding tasks, retain the capability target even when cost/speed matters.
        return (abs(target - q), c if preference != "speed" else s,
                s if preference != "speed" else c, model["id"])

    selected = min(models, key=rank)
    reasons = [scores[axis]["reason"] for axis in ("expertise", "reasoning", "scope")
               if scores[axis]["value"] is not None and scores[axis]["value"] >= 2]
    reason = " ".join(reasons[:2]) or "현재 확인된 작업 범위에 맞춰 생성 비용과 응답 속도를 고려했습니다."
    if preference != "balanced":
        reason += {"cost": " 비용 우선 선호를 반영했습니다.", "speed": " 응답 속도 우선 선호를 반영했습니다.",
                   "quality": " 결과 품질 우선 선호를 반영했습니다."}[preference]
    uncertain = len(known) < 3 or scores["clarity"]["value"] is None or scores["clarity"]["value"] < 2
    return {
        "model": selected["id"], "profile": profile, "reason": reason,
        "uncertainty": "입력 정보가 부족해 추천이 달라질 수 있습니다. 보완 후 다시 검토할 수 있습니다." if uncertain else None,
        "policyVersion": POLICY_VERSION, "allowedModels": [model["id"] for model in models],
        "features": {"contextCount": len(snapshot["brief"]["context"]),
                     "actionCount": len(snapshot["brief"]["actionItems"]),
                     "constraintCharacters": len(snapshot["brief"].get("constraints") or "")},
    }
