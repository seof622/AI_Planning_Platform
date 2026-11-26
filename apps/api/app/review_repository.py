"""Immutable review/decision history and short transactions around AI calls."""

from copy import deepcopy
from datetime import timezone
import json
import os
import math

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (AIExecutionRunModel, PlanningDecisionModel, PlanningReviewModel,
                     PlanningQualityEvaluationModel, ProjectModel, utc_now)
from .repository import get_planning_result, to_iso
from .review_schemas import ReviewInput, input_hash


def require_project(session: Session, project_id: str, *, lock: bool = False) -> ProjectModel:
    query = select(ProjectModel).where(ProjectModel.id == project_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    project = session.scalar(query)
    if project is None:
        raise HTTPException(404, "프로젝트를 찾을 수 없습니다.")
    return project


def require_review(session: Session, project_id: str, review_id: str) -> PlanningReviewModel:
    review = session.get(PlanningReviewModel, review_id)
    if review is None or review.project_id != project_id:
        raise HTTPException(404, "입력 검토를 찾을 수 없습니다.")
    return review


def check_current_input(project: ProjectModel, review: PlanningReviewModel) -> None:
    if project.input_revision != review.input_revision:
        raise HTTPException(409, "입력이 변경됐습니다. AI 입력 검토를 다시 진행해 주세요.")
    try:
        current = ReviewInput(requirement=project.requirement_draft,
                              brief=project.planning_brief or {},
                              preference=review.input_snapshot["preference"])
    except ValueError:
        raise HTTPException(409, "입력이 변경됐습니다. AI 입력 검토를 다시 진행해 주세요.")
    if input_hash(current.model_dump()) != review.input_hash:
        raise HTTPException(409, "입력이 변경됐습니다. AI 입력 검토를 다시 진행해 주세요.")


def check_latest_review(session: Session, review: PlanningReviewModel) -> None:
    latest_id = session.scalar(select(PlanningReviewModel.id).where(
        PlanningReviewModel.project_id == review.project_id
    ).order_by(PlanningReviewModel.created_at.desc(), PlanningReviewModel.id.desc()).limit(1))
    if latest_id != review.id:
        raise HTTPException(409, "새 검토가 있습니다. 최신 검토 내용을 확인해 주세요.")


def serialize_review(review: PlanningReviewModel) -> dict:
    return {
        "id": review.id, "projectId": review.project_id, "parentReviewId": review.parent_review_id,
        "input": deepcopy(review.input_snapshot), "inputHash": review.input_hash,
        "feedback": deepcopy(review.feedback), "recommendation": deepcopy(review.recommendation),
        "promptVersion": review.prompt_version, "rubricVersion": review.rubric_version,
        "createdAt": to_iso(review.created_at),
    }


def serialize_decision(decision: PlanningDecisionModel, review: PlanningReviewModel) -> dict:
    return {
        "id": decision.id, "projectId": decision.project_id, "reviewId": decision.review_id,
        "kind": decision.kind, "selectedModel": decision.selected_model,
        "acceptedRecommendation": decision.selected_model == (review.recommendation or {}).get("model"),
        "snapshot": deepcopy(decision.snapshot), "createdAt": to_iso(decision.created_at),
    }


def serialize_run(run: AIExecutionRunModel) -> dict:
    return {
        "id": run.id, "projectId": run.project_id, "reviewId": run.review_id,
        "confirmationId": run.confirmation_id, "kind": run.kind, "status": run.status,
        "idempotencyKey": run.request_key, "requestedModel": run.requested_model,
        "resolvedModel": run.resolved_model, "usage": run.usage, "estimatedCost": run.estimated_cost,
        "rateVersion": run.rate_version, "errorCode": run.error_code, "errorMessage": run.error_message,
        "resultId": run.result_id, "createdAt": to_iso(run.created_at),
        "finishedAt": to_iso(run.finished_at) if run.finished_at else None, "elapsedMs": run.elapsed_ms,
    }


def execution_response(session: Session, run: AIExecutionRunModel) -> dict:
    # Longer than the configured provider timeout; no automatic retry after a lost worker.
    started = run.created_at.replace(tzinfo=timezone.utc) if run.created_at.tzinfo is None else run.created_at
    if run.status == "running" and (utc_now() - started).total_seconds() > 600:
        session.refresh(run, with_for_update=True)
        if run.status == "running":
            run.status = "interrupted"
            run.error_code = "execution_interrupted"
            run.error_message = "실행 완료 여부를 확인하지 못했습니다. 비용이 발생했을 수 있습니다. 확인 후 다시 시도해 주세요."
            finish_run(run, {})
        session.commit()
    review = session.get(PlanningReviewModel, run.review_id) if run.review_id else None
    return {"run": serialize_run(run), "review": serialize_review(review) if review else None,
            "result": get_planning_result(session, run.project_id, run.result_id) if run.result_id else None}


def find_run(session: Session, project_id: str, kind: str, key: str) -> AIExecutionRunModel | None:
    return session.scalar(select(AIExecutionRunModel).where(
        AIExecutionRunModel.project_id == project_id, AIExecutionRunModel.kind == kind,
        AIExecutionRunModel.request_key == key))


def ensure_same_request(stored_hash: str, request_hash: str) -> None:
    if stored_hash != request_hash:
        raise HTTPException(409, "같은 요청 키를 다른 내용에 사용할 수 없습니다.")


def finish_run(run: AIExecutionRunModel, telemetry: dict) -> None:
    run.finished_at = utc_now()
    started = run.created_at.replace(tzinfo=timezone.utc) if run.created_at.tzinfo is None else run.created_at
    run.elapsed_ms = max(0, int((run.finished_at - started).total_seconds() * 1000))
    run.resolved_model = telemetry.get("resolvedModel")
    run.usage = telemetry.get("usage")
    run.estimated_cost, run.rate_version = estimate_cost(run.requested_model, run.usage)


def estimate_cost(model: str, usage: dict | None) -> tuple[float | None, str | None]:
    # Operator-supplied USD per million tokens. Never invent or silently default prices to zero.
    if usage is None:
        return None, None
    try:
        rates = json.loads(os.getenv("PLANNING_MODEL_RATES_JSON", "{}"))
        rate = rates.get(model)
        if not rate or not rate.get("version"):
            return None, None
        cached = (usage.get("input_tokens_details") or {}).get("cached_tokens", 0)
        if cached and "cachedInputPerMillion" not in rate:
            return None, None
        input_tokens, output_tokens = usage["input_tokens"], usage["output_tokens"]
        prices = [float(rate["inputPerMillion"]), float(rate["outputPerMillion"]),
                  float(rate.get("cachedInputPerMillion", 0))]
        if not all(math.isfinite(price) and price >= 0 for price in prices) or min(input_tokens, output_tokens, cached) < 0 or cached > input_tokens:
            return None, None
        cost = ((input_tokens - cached) * prices[0] + output_tokens * prices[1] + cached * prices[2]) / 1_000_000
        return round(cost, 8), str(rate["version"])
    except (ValueError, TypeError, KeyError, AttributeError):
        return None, None


def serialize_quality(evaluation: PlanningQualityEvaluationModel) -> dict:
    return {"id": evaluation.id, "resultId": evaluation.result_id, "source": evaluation.source,
            "criteriaVersion": evaluation.criteria_version, "rating": evaluation.rating,
            "comment": evaluation.comment, "createdAt": to_iso(evaluation.created_at)}
