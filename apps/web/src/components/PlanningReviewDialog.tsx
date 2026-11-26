"use client";

import { useEffect, useRef, useState } from "react";
import type { PlanningReview, ReviewAxis, ReviewPreference } from "@ai-planning-platform/shared";
import { usePlanningReviewStore, isCurrentReview } from "../store/planningReviewStore";
import { usePlanningStore } from "../store/planningStore";
import { getQualityEvaluations, submitQualityEvaluation } from "../lib/planningClient";
import { criterionLabels, planTypeLabels } from "../lib/planningInput";
import { WorkspaceIcon } from "./WorkspaceIcon";

const axes: Record<ReviewAxis, string> = { clarity: "입력 명확성", expertise: "전문지식 요구도", reasoning: "추론·계획 복잡도", scope: "작업 규모" };
const preferenceLabels: Record<ReviewPreference, string> = { balanced: "균형", cost: "생성 비용", quality: "결과 품질", speed: "AI 응답 속도" };

function ReviewExcerpt({ text, label, limit = 140 }: { text: string; label: string; limit?: number }) {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= limit) return <p>{singleLine}</p>;
  return <div className="review-excerpt">
    <p>{singleLine.slice(0, limit).trimEnd()}…</p>
    <details><summary>{label}</summary><p className="review-text">{text}</p></details>
  </div>;
}

function ReviewGoal({ goal }: { goal: string }) {
  return <section className="review-goal">
    <h3>AI가 이해한 목표</h3><ReviewExcerpt text={goal} label="목표 전문 보기" />
  </section>;
}

function ReviewInputContents({ input }: { input: PlanningReview["input"] }) {
  const { brief } = input;
  return <dl className="review-input">
    <div><dt>계획 주제</dt><dd className="review-text">{input.requirement}</dd></div>
    {brief.context.length ? <div><dt>상황 / 대상</dt><dd><ul>{brief.context.map((item, i) => <li key={i}>{item}</li>)}</ul></dd></div> : null}
    {brief.actionItems.length ? <div><dt>해야 할 일</dt><dd><ul>{brief.actionItems.map((item, i) =>
      <li key={i}>{item.necessity === "required" ? "필수" : "선택"} · {item.title}</li>)}</ul></dd></div> : null}
    {brief.constraints ? <div><dt>제약조건</dt><dd className="review-text">{brief.constraints}</dd></div> : null}
    <div><dt>계획 유형 · 성공 기준</dt><dd>{planTypeLabels[brief.planType]} · {criterionLabels[brief.successCriterion]}</dd></div>
  </dl>;
}

function ReviewDetails({ review }: { review: PlanningReview }) {
  const feedback = review.feedback;
  if (!feedback) return null;
  return <>
    {feedback.clearPoints.length ? <section><h3>명확한 내용</h3><ul>{feedback.clearPoints.map((point, i) => <li key={i}>{point}</li>)}</ul></section> : null}
    {feedback.assumptions.length ? <section><h3>진행 가정</h3><ul>{feedback.assumptions.map((point, i) => <li key={i}>{point}</li>)}</ul></section> : null}
    <section className="review-assessment"><h3>입력 평가와 판단 근거</h3>
      <p className="form-field__hint">0~4단계의 AI 추정치입니다. 정보가 부족한 항목은 판단을 보류합니다.</p>
      <dl>{(Object.keys(axes) as ReviewAxis[]).map((axis) => {
        const score = feedback.assessment[axis];
        return <div key={axis}><dt>{axes[axis]} <strong>{score.value === null ? "판단 보류" : `${score.value}/4`}</strong></dt>
          <dd>{score.reason}{score.missingInformation ? <p>필요한 정보: {score.missingInformation}</p> : null}</dd></div>;
      })}</dl>
    </section>
    <section><h3>검토한 입력</h3><ReviewInputContents input={review.input} /></section>
  </>;
}

function ReviewWarnings({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return <section className="review-warning"><h3>확인할 조건</h3><ul>{warnings.map((point, i) => <li key={i}>{point}</li>)}</ul></section>;
}

function ReviewHistoryContents({ review }: { review: PlanningReview }) {
  if (!review.feedback) return <p>완료된 검토 결과가 없습니다. 실행 기록을 확인해 주세요.</p>;
  return <>
    <ReviewGoal goal={review.feedback.goal} />
    <ReviewWarnings warnings={review.feedback.warnings} />
    <details className="review-disclosure"><summary>검토 세부 내용</summary>
      <div className="review-details-body"><ReviewDetails review={review} /></div>
    </details>
  </>;
}

function QualityFeedback({ projectId, resultId }: { projectId: string; resultId: string }) {
  const [rating, setRating] = useState(4);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestKey = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    void getQualityEvaluations(projectId, resultId).then((history) => {
      if (active && history.length) setNotice(`저장된 품질 피드백 ${history.length}건`);
    }).catch(() => { if (active) setNotice("이전 품질 피드백을 불러오지 못했습니다. 새 피드백은 작성할 수 있습니다."); });
    return () => { active = false; };
  }, [projectId, resultId]);
  return <form className="review-quality" onSubmit={async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      requestKey.current ??= crypto.randomUUID();
      await submitQualityEvaluation(projectId, resultId, rating, comment, requestKey.current);
      setNotice("품질 피드백을 저장했습니다.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "피드백 저장에 실패했습니다."); }
    finally { setBusy(false); }
  }}>
    <h3>현재 결과의 품질 피드백</h3><p className="form-field__hint">입력 확인과 별도로, 생성된 계획의 만족도를 기록합니다.</p>
    <label>계획 만족도<select aria-label="계획 만족도" value={rating} disabled={busy} onChange={(event) => { setRating(Number(event.target.value)); requestKey.current = null; }}>
      {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}점</option>)}</select></label>
    <label>품질 의견<textarea aria-label="품질 의견" value={comment} maxLength={2000} disabled={busy}
      onChange={(event) => { setComment(event.target.value); requestKey.current = null; }} /></label>
    <button className="button" type="submit" disabled={busy}>{busy ? "저장 중" : "품질 피드백 저장"}</button>
    {notice ? <p role="status">{notice}</p> : null}
  </form>;
}

export function PlanningReviewDialog({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const state = usePlanningReviewStore();
  const planning = usePlanningStore();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [finalReviewId, setFinalReviewId] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const review = state.review;
  const finalStep = finalReviewId !== null && finalReviewId === review?.id;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (state.open && !dialog?.open) dialog?.showModal();
    if (!state.open && dialog?.open) dialog.close();
  }, [state.open]);
  useEffect(() => { setAnswers({}); setAccepted(false); }, [review?.id]);
  useEffect(() => { setAccepted(false); }, [planning.selectedModel, state.preference]);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [review?.id, state.mode, finalStep]);
  const busy = state.status === "reviewing" || state.status === "confirming";
  const current = state.status === "ready" && isCurrentReview(review, state.preference);
  const modelValid = planning.models.some((model) => model.id === planning.selectedModel);
  const recommended = planning.models.find((model) => model.id === review?.recommendation?.model);
  const associatedReview = planning.planningResult?.metadata.reviewId;
  const hasAnswers = Object.values(answers).some((answer) => answer.trim());

  function changeStep(reviewId: string | null) {
    setFinalReviewId(reviewId);
    setAccepted(false);
    titleRef.current?.focus({ preventScroll: true });
  }

  async function continueToConfirmation() {
    if (!current || !review?.feedback) return;
    if (!hasAnswers) {
      changeStep(review.id);
      return;
    }
    const updated = structuredClone(planning.planningBrief);
    let requirement = planning.requirementText;
    review.feedback.questions.forEach((question, index) => {
      const answer = answers[index]?.trim();
      if (!answer) return;
      if (question.field === "actionItems") updated.actionItems.push({ text: answer, necessity: "required" });
      else if (question.field === "requirement") requirement += `\n${question.question} ${answer}`;
      else if (question.field === "constraints" || question.field === "completion") updated.constraints += `${updated.constraints ? "\n" : ""}${question.question} ${answer}`;
      else updated.context.push(`${question.question} ${answer}`);
    });
    planning.setRequirementText(requirement);
    planning.setPlanningBriefField("context", updated.context);
    planning.setPlanningBriefField("actionItems", updated.actionItems);
    planning.setPlanningBriefField("constraints", updated.constraints);
    await state.startReview();
    const latest = usePlanningReviewStore.getState();
    if (latest.open && latest.mode === "review" && latest.status === "ready"
      && latest.review?.parentReviewId === review.id && isCurrentReview(latest.review, latest.preference)) {
      changeStep(latest.review.id);
    }
  }

  return <dialog ref={dialogRef} className="planning-review-dialog" aria-labelledby="planning-review-title"
    onCancel={(event) => { event.preventDefault(); state.close(); }} onClose={state.close}>
    <header className="review-dialog-header"><div>
      {state.mode === "review" ? <p className="review-eyebrow">{finalStep ? "생성 전 최종 확인" : "입력 피드백"}</p> : null}
      <h2 ref={titleRef} tabIndex={-1} id="planning-review-title">{state.mode === "history" ? "검토·추천 이력" : "AI 입력 검토"}</h2></div>
      <button className="button button--icon" type="button" disabled={state.status === "confirming"} aria-label="입력 검토 창 닫기" onClick={state.close}><WorkspaceIcon name="close" /></button>
    </header>
    <div className="review-dialog-body" ref={bodyRef}>
      {state.mode === "history" ? <>
        {state.historyError ? <p role="alert">{state.historyError}</p> : null}
        {state.historyLoading ? <p role="status">이력을 불러오는 중…</p> : null}
        <button className="button" type="button" disabled={state.historyLoading} onClick={() => void state.showHistory()}>이력 새로고침</button>
        {typeof associatedReview === "string" ? <button className="button" type="button" onClick={() => void state.inspect(associatedReview)}>현재 결과의 생성 검토 보기</button> : null}
        {!state.historyLoading && !state.history.length ? <p>아직 검토 이력이 없습니다. 기존 결과는 계속 열람할 수 있습니다.</p> : null}
        <ol className="review-history-list">{state.history.map((item) => <li key={item.id}>
          <button className="button" type="button" aria-pressed={state.detail?.review.id === item.id}
            onClick={() => void state.inspect(item.id)}>{item.input.requirement} · {new Date(item.createdAt).toLocaleString("ko-KR")}</button>
          <span>{item.feedback ? `추천: ${planning.models.find((model) => model.id === item.recommendation?.model)?.label ?? item.recommendation?.model ?? "기록 없음"}` : "검토 미완료"}</span>
        </li>)}</ol>
        {state.detail ? <section className="review-history-detail"><h3>검토 상세</h3><ReviewHistoryContents key={state.detail.review.id} review={state.detail.review} />
          <h3>모델 선택·최종 확인</h3>{state.detail.decisions.length ? <ul>{state.detail.decisions.map((decision) => <li key={decision.id}>
            {decision.kind === "confirmation" ? "최종 확인" : "모델 선택"}: {decision.selectedModel} · 추천 {decision.acceptedRecommendation ? "수락" : "변경"}
          </li>)}</ul> : <p>아직 모델 선택·확인 기록이 없습니다.</p>}
          <h3>실행 기록</h3><ul>{state.detail.runs.map((run) => <li key={run.id}>
            {run.kind === "review" ? "입력 검토" : "계획 생성"} · {{ running: "진행 중", succeeded: "완료", failed: "실패", interrupted: "완료 여부 확인 필요" }[run.status]}
            {run.elapsedMs !== null ? ` · ${(run.elapsedMs / 1000).toFixed(1)}초` : ""}
            {run.usage?.total_tokens !== undefined ? ` · ${run.usage.total_tokens}토큰` : " · 사용량 확인 불가"}
            {run.estimatedCost === null ? " · 비용 확인 불가" : ` · 추정 $${run.estimatedCost.toFixed(6)}`}
            {run.errorMessage ? <p>{run.errorMessage}</p> : null}
          </li>)}</ul>
        </section> : null}
        {planning.selectedProjectId && planning.selectedPlanningResultId ? <QualityFeedback key={planning.selectedPlanningResultId}
          projectId={planning.selectedProjectId} resultId={planning.selectedPlanningResultId} /> : null}
      </> : <>
        {state.status === "reviewing" ? <p role="status">AI가 입력과 필요한 정보를 검토하고 있습니다…</p> : null}
        {state.error ? <p className="review-warning" role="alert">{state.error}</p> : null}
        {state.status === "uncertain" ? <button className="button" type="button" onClick={() => void state.checkExecution()}>처리 상태 확인</button> : null}
        {state.status === "error" ? <button className="button" type="button" onClick={() => void state.startReview()}>입력 검토 다시 시도</button> : null}
        {review?.feedback ? <>
          {!current && !busy ? <p className="review-warning" role="status">이전 입력의 검토입니다. 현재 입력으로 다시 검토한 뒤 생성할 수 있습니다.</p> : null}
          {!finalStep ? <>
            <div className="review-overview" key={`overview-${review.id}`}>
              <ReviewGoal goal={review.feedback.goal} />
              {review.recommendation ? <section className="review-recommendation">
                <h3>추천 모델 <strong>{recommended?.label ?? review.recommendation.model}</strong></h3>
                <ReviewExcerpt text={review.recommendation.reason} label="추천 이유 전문 보기" limit={110} />
                {review.recommendation.uncertainty ? <p className="review-muted">입력을 보완하면 추천이 달라질 수 있어요.</p> : null}
              </section> : null}
            </div>
            <ReviewWarnings warnings={review.feedback.warnings} />
            {review.feedback.questions.length ? <section className="review-questions" key={`questions-${review.id}`}>
              <div className="review-questions-heading"><h3>보완 질문</h3><p>답할 수 있는 질문만 골라 작성하세요.</p></div>
              <ol className="review-question-list">{review.feedback.questions.map((question, index) => <li key={index}>
                <span className="review-question-number" aria-hidden="true">{index + 1}</span>
                <div className="review-question-content">
                  <label id={`review-question-${index}`} htmlFor={`review-answer-${index}`}>{question.question}</label>
                  <textarea id={`review-answer-${index}`} aria-label={`보완 답변 ${index + 1}`} aria-describedby={`review-question-${index}`}
                    rows={2} placeholder="답변 입력" value={answers[index] ?? ""} maxLength={2000} disabled={busy || !current}
                    onChange={(event) => setAnswers((previous) => ({ ...previous, [index]: event.target.value }))} />
                  <details className="review-question-reason"><summary>질문 이유</summary><p>{question.reason}</p></details>
                </div>
              </li>)}</ol>
            </section> : <p className="review-no-questions"><WorkspaceIcon name="check" />추가로 확인할 핵심 질문이 없습니다.</p>}
            <details className="review-disclosure" key={`details-${review.id}`}><summary>검토 세부 내용</summary>
              <div className="review-details-body">
                <ReviewDetails review={review} />
                <label>모델 선택 우선 기준<select value={state.preference} disabled={busy}
                  onChange={(event) => state.setPreference(event.target.value as ReviewPreference)}>
                  {(Object.keys(preferenceLabels) as ReviewPreference[]).map((value) => <option key={value} value={value}>{preferenceLabels[value]}</option>)}
                </select></label>
              </div>
            </details>
          </> : <section className="review-confirmation"><h3>최종 입력과 생성 모델</h3>
            <ReviewInputContents input={review.input} />
            <ReviewWarnings warnings={review.feedback.warnings} />
            {review.feedback.assumptions.length ? <section className="review-assumptions"><h3>계획에 적용할 가정</h3>
              <ul>{review.feedback.assumptions.map((point, i) => <li key={i}>{point}</li>)}</ul>
            </section> : null}
            <label>계획 생성 모델<select aria-label="계획 생성 모델" value={planning.selectedModel}
              disabled={busy || planning.modelStatus !== "ready"} onChange={(event) => void state.selectModel(event.target.value)}>
              {!planning.models.length ? <option value="">사용 가능한 모델 없음</option> : null}
              {planning.models.map((model) => <option key={model.id} value={model.id}>{model.label}{review.recommendation?.model === model.id ? " · 추천" : ""}</option>)}
            </select></label>
            {recommended ? <button className="button" type="button" disabled={busy} onClick={() => void state.selectModel(recommended.id)}>추천 모델 선택</button> : null}
            {!modelValid ? <><p role="alert">사용 가능한 생성 모델을 선택해 주세요.</p>
              <button className="button" type="button" disabled={busy} onClick={() => void planning.loadModels()}>모델 다시 불러오기</button></> : null}
            <label className="review-accept"><input type="checkbox" checked={accepted} disabled={busy || !current}
              onChange={(event) => setAccepted(event.target.checked)} />최종 입력과 위 진행 가정을 확인했습니다.</label>
          </section>}
        </> : null}
      </>}
    </div>
    {state.mode === "review" ? <footer className="review-dialog-footer">
      {finalStep ? <button className="button" type="button" disabled={busy} onClick={() => changeStep(null)}>피드백 돌아가기</button>
      : <button className="button" type="button" disabled={busy} onClick={() => {
        state.close(); requestAnimationFrame(() => document.getElementById("planning-requirement")?.focus());
      }}>입력 직접 수정</button>}
      {state.status === "expired" ? <button className="button button--primary" type="button" disabled={busy} onClick={() => void state.startReview()}>현재 입력으로 다시 검토</button>
        : finalStep ? <button className="button button--primary" type="button" disabled={busy || !current || !accepted || !modelValid}
          onClick={() => void onConfirm()}>{state.status === "confirming" ? "확인 저장 중" : "확인하고 계획 생성"}</button>
          : <button className="button button--primary" type="button" disabled={busy || !current} onClick={() => void continueToConfirmation()}>
            {hasAnswers ? state.status === "reviewing" ? "답변 검토 중…" : "답변 반영하고 계속"
              : review?.feedback?.questions.length ? "현재 정보로 진행" : "최종 내용 확인"}</button>}
    </footer> : null}
  </dialog>;
}
