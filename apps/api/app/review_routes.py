from copy import deepcopy
import os
import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from planning_ai.review import (InputFeedback, OpenAIReviewProvider, REVIEW_PROMPT_VERSION,
                                REVIEW_RUBRIC_VERSION, REVIEW_CONTEXT_VERSION)
from planning_ai.telemetry import capture_usage

from .config import get_allowed_openai_models, get_default_openai_model
from .database import get_db_session
from .models import (AIExecutionRunModel, PlanningDecisionModel, PlanningReviewModel,
                     PlanningQualityEvaluationModel, new_id)
from .model_recommendation import recommend_model
from .repository import get_planning_result, save_planning_result, mark_draft_change
from .review_repository import (check_current_input, check_latest_review, ensure_same_request,
                                execution_response, find_run, finish_run, require_project, require_review,
                                serialize_decision, serialize_quality, serialize_review, serialize_run)
from .review_schemas import (ConfirmedGeneration, QualityEvaluationCreate, ReviewCreate,
                             ReviewDecision, input_hash)
from .schemas import PlanningRequest

router = APIRouter()


def get_review_provider(model: str):
    return OpenAIReviewProvider(model=model)


def validate_model(model: str) -> None:
    if model not in get_allowed_openai_models():
        raise HTTPException(422, "현재 허용된 AI 모델을 선택해 주세요.")


def fail_execution(session: Session, run_id: str, telemetry: dict, error: Exception) -> dict:
    session.rollback()
    run = session.get(AIExecutionRunModel, run_id, with_for_update=True)
    if run.status == "running":
        run.status = "failed"
        run.error_code = "ai_execution_failed"
        run.error_message = "AI 요청을 완료하지 못했습니다. 입력과 기존 결과를 보존했습니다. 다시 시도할 수 있습니다."
        cause = error
        for _ in range(8):
            code = getattr(cause, "status_code", None)
            if code and cause.__class__.__module__.startswith("openai"):
                run.error_code = f"provider_http_{code}"
                break
            if "Timeout" in type(cause).__name__:
                run.error_code = "provider_timeout"
                break
            if type(cause).__name__ == "PlanningConfigurationError":
                run.error_code = "ai_configuration_error"
                break
            if cause.__cause__ is None:
                break
            cause = cause.__cause__
        logging.getLogger(__name__).warning("AI execution failed: run=%s code=%s type=%s", run_id, run.error_code, type(error).__name__)
        finish_run(run, telemetry)
        session.commit()
    return execution_response(session, run)


@router.post("/projects/{project_id}/planning-reviews")
def create_review(project_id: str, payload: ReviewCreate, session: Session = Depends(get_db_session)):
    project = require_project(session, project_id, lock=True)
    snapshot = payload.input.model_dump()
    request_digest = input_hash({"input": snapshot, "parentReviewId": payload.parentReviewId})
    existing = find_run(session, project_id, "review", payload.idempotencyKey)
    if existing:
        ensure_same_request(existing.request_hash, request_digest)
        return execution_response(session, existing)
    previous = None
    if payload.parentReviewId:
        parent = require_review(session, project_id, payload.parentReviewId)
        previous = deepcopy(parent.feedback)
    model = os.getenv("PLANNING_REVIEW_MODEL", get_default_openai_model()).strip()
    validate_model(model)
    mark_draft_change(project, snapshot["requirement"], snapshot["brief"], project.selected_model)
    review = PlanningReviewModel(
        id=new_id("review"), project_id=project_id, parent_review_id=payload.parentReviewId,
        input_snapshot=snapshot, input_hash=input_hash(snapshot), input_revision=project.input_revision,
        prompt_version=REVIEW_PROMPT_VERSION, rubric_version=REVIEW_RUBRIC_VERSION,
    )
    run = AIExecutionRunModel(
        id=new_id("ai-run"), project_id=project_id, review_id=review.id,
        kind="review", request_key=payload.idempotencyKey, request_hash=request_digest,
        requested_model=model, status="running",
    )
    # The reviewed snapshot is the current draft, independent of the model selection.
    project.requirement_draft = snapshot["requirement"]
    project.planning_brief = snapshot["brief"]
    session.add(review)
    session.flush()
    session.add(run)
    session.commit()  # Persist the attempt and release project locks before external calls.
    run_id = run.id
    telemetry = {}
    try:
        with capture_usage() as telemetry:
            feedback = InputFeedback.model_validate(get_review_provider(model).review(snapshot, previous)).model_dump()
        # Persist output only if this worker still owns the running attempt.
        session.refresh(run, with_for_update=True)
        if run.status != "running":
            return execution_response(session, run)
        review.feedback = feedback
        review.recommendation = recommend_model(snapshot, feedback)
        run.status = "succeeded"
        finish_run(run, telemetry)
        session.commit()
        return execution_response(session, run)
    except Exception as error:
        return fail_execution(session, run_id, telemetry, error)


@router.get("/projects/{project_id}/planning-reviews")
def list_reviews(project_id: str, session: Session = Depends(get_db_session)):
    require_project(session, project_id)
    reviews = session.scalars(select(PlanningReviewModel).where(
        PlanningReviewModel.project_id == project_id
    ).order_by(PlanningReviewModel.created_at.desc(), PlanningReviewModel.id.desc()).limit(100))
    return [serialize_review(review) for review in reviews]


@router.get("/projects/{project_id}/planning-reviews/{review_id}")
def review_detail(project_id: str, review_id: str, session: Session = Depends(get_db_session)):
    review = require_review(session, project_id, review_id)
    decisions = session.scalars(select(PlanningDecisionModel).where(
        PlanningDecisionModel.review_id == review_id
    ).order_by(PlanningDecisionModel.created_at))
    runs = list(session.scalars(select(AIExecutionRunModel).where(
        AIExecutionRunModel.review_id == review_id
    ).order_by(AIExecutionRunModel.created_at)))
    for run in runs:
        execution_response(session, run)
    return {"review": serialize_review(review),
            "decisions": [serialize_decision(decision, review) for decision in decisions],
            "runs": [serialize_run(run) for run in runs]}


@router.post("/projects/{project_id}/planning-reviews/{review_id}/decisions")
def decide(project_id: str, review_id: str, payload: ReviewDecision,
           session: Session = Depends(get_db_session)):
    project = require_project(session, project_id, lock=True)
    review = require_review(session, project_id, review_id)
    digest = input_hash({"reviewId": review_id, **payload.model_dump(exclude={"idempotencyKey"})})
    existing = session.scalar(select(PlanningDecisionModel).where(
        PlanningDecisionModel.project_id == project_id,
        PlanningDecisionModel.request_key == payload.idempotencyKey))
    if existing:
        ensure_same_request(existing.request_hash, digest)
        return serialize_decision(existing, review)
    if review.feedback is None:
        raise HTTPException(409, "AI 검토가 완료된 뒤 확인해 주세요.")
    check_latest_review(session, review)
    check_current_input(project, review)
    if payload.inputHash != review.input_hash:
        raise HTTPException(409, "확인할 입력이 검토 내용과 다릅니다.")
    validate_model(payload.selectedModel)
    if payload.kind == "confirmation" and not payload.acceptedAssumptions:
        raise HTTPException(422, "최종 입력과 진행 가정을 확인해 주세요.")
    if project.selected_model != payload.selectedModel:
        project.model_revision += 1
    decision = PlanningDecisionModel(
        id=new_id("decision"), project_id=project_id, review_id=review_id, kind=payload.kind,
        selected_model=payload.selectedModel, request_key=payload.idempotencyKey, request_hash=digest,
        snapshot={"input": deepcopy(review.input_snapshot),
                  "assumptions": deepcopy(review.feedback["assumptions"]), "selectedModel": payload.selectedModel,
                  "inputRevision": project.input_revision, "modelRevision": project.model_revision},
    )
    project.selected_model = payload.selectedModel
    session.add(decision)
    session.commit()
    return serialize_decision(decision, review)


@router.post("/projects/{project_id}/planning-confirmations/{confirmation_id}/generate")
def generate_confirmed(project_id: str, confirmation_id: str, payload: ConfirmedGeneration,
                       session: Session = Depends(get_db_session)):
    project = require_project(session, project_id, lock=True)
    decision = session.get(PlanningDecisionModel, confirmation_id)
    if decision is None or decision.project_id != project_id or decision.kind != "confirmation":
        raise HTTPException(404, "최종 확인 기록을 찾을 수 없습니다.")
    digest = input_hash({"confirmationId": confirmation_id})
    existing = find_run(session, project_id, "generation", payload.idempotencyKey)
    if existing:
        ensure_same_request(existing.request_hash, digest)
        return execution_response(session, existing)
    active = session.scalar(select(AIExecutionRunModel).where(
        AIExecutionRunModel.confirmation_id == confirmation_id,
        AIExecutionRunModel.status.in_(["running", "succeeded"])))
    if active:
        return execution_response(session, active)
    review = require_review(session, project_id, decision.review_id)
    check_latest_review(session, review)
    check_current_input(project, review)
    if project.selected_model != decision.selected_model or project.model_revision != decision.snapshot["modelRevision"]:
        raise HTTPException(409, "선택 모델이 변경됐습니다. 다시 확인해 주세요.")
    validate_model(decision.selected_model)
    run = AIExecutionRunModel(
        id=new_id("ai-run"), project_id=project_id, review_id=review.id, confirmation_id=decision.id,
        kind="generation", request_key=payload.idempotencyKey, request_hash=digest,
        requested_model=decision.selected_model, status="running",
    )
    snapshot = deepcopy(decision.snapshot)
    project_input = {"id": project.id, "title": project.title, "description": project.description}
    session.add(run)
    session.commit()
    run_id = run.id
    telemetry = {}
    try:
        # Lazy import preserves the existing workflow dependency injection and avoids a router cycle.
        from .main import generate_result
        request = PlanningRequest(
            requirement=snapshot["input"]["requirement"], brief=snapshot["input"]["brief"],
            project=project_input, options={"model": snapshot["selectedModel"]},
            confirmedReview={"assumptions": snapshot["assumptions"]},
        )
        with capture_usage() as telemetry:
            result = deepcopy(generate_result(request))
        # Use the same project-then-run lock order as duplicate generation requests.
        project = require_project(session, project_id, lock=True)
        session.refresh(run, with_for_update=True)
        if run.status != "running":
            return execution_response(session, run)
        result.setdefault("metadata", {}).update({
            "reviewId": review.id, "confirmationId": decision.id, "executionRunId": run.id,
            "reviewContextVersion": REVIEW_CONTEXT_VERSION,
        })
        persisted = save_planning_result(
            session, project=project, requirement_content=snapshot["input"]["requirement"],
            planning_brief=snapshot["input"]["brief"], selected_model=snapshot["selectedModel"],
            result=result, commit=False, update_draft=False,
        )
        run.result_id = persisted["metadata"]["resultId"]
        run.status = "succeeded"
        finish_run(run, telemetry)
        session.commit()  # Result and successful execution become durable together.
        return execution_response(session, run)
    except Exception as error:
        return fail_execution(session, run_id, telemetry, error)


@router.get("/projects/{project_id}/ai-execution-runs/by-key/{request_key}")
def run_by_key(project_id: str, request_key: str, kind: Literal["review", "generation"],
               session: Session = Depends(get_db_session)):
    require_project(session, project_id)
    run = find_run(session, project_id, kind, request_key)
    if run is None:
        raise HTTPException(404, "실행 기록을 찾지 못했습니다. 같은 요청으로 다시 확인할 수 있습니다.")
    return execution_response(session, run)


@router.get("/projects/{project_id}/ai-execution-runs/{run_id}")
def run_detail(project_id: str, run_id: str, session: Session = Depends(get_db_session)):
    run = session.get(AIExecutionRunModel, run_id)
    if run is None or run.project_id != project_id:
        raise HTTPException(404, "실행 기록을 찾을 수 없습니다.")
    return execution_response(session, run)


@router.post("/projects/{project_id}/planning-results/{result_id}/quality-evaluations")
def evaluate_quality(project_id: str, result_id: str, payload: QualityEvaluationCreate,
                     session: Session = Depends(get_db_session)):
    require_project(session, project_id, lock=True)
    if get_planning_result(session, project_id, result_id) is None:
        raise HTTPException(404, "계획 결과를 찾을 수 없습니다.")
    digest = input_hash({"resultId": result_id, **payload.model_dump(exclude={"idempotencyKey"})})
    existing = session.scalar(select(PlanningQualityEvaluationModel).where(
        PlanningQualityEvaluationModel.project_id == project_id,
        PlanningQualityEvaluationModel.request_key == payload.idempotencyKey))
    if existing:
        ensure_same_request(existing.request_hash, digest)
        return serialize_quality(existing)
    evaluation = PlanningQualityEvaluationModel(
        id=new_id("quality"), project_id=project_id, result_id=result_id,
        rating=payload.rating, comment=payload.comment.strip(), request_key=payload.idempotencyKey,
        request_hash=digest, source="user", criteria_version="user-quality-v1",
    )
    session.add(evaluation)
    session.commit()
    return serialize_quality(evaluation)


@router.get("/projects/{project_id}/planning-results/{result_id}/quality-evaluations")
def quality_history(project_id: str, result_id: str, session: Session = Depends(get_db_session)):
    if get_planning_result(session, project_id, result_id) is None:
        raise HTTPException(404, "계획 결과를 찾을 수 없습니다.")
    return [serialize_quality(item) for item in session.scalars(select(PlanningQualityEvaluationModel).where(
        PlanningQualityEvaluationModel.project_id == project_id,
        PlanningQualityEvaluationModel.result_id == result_id).order_by(PlanningQualityEvaluationModel.created_at))]
