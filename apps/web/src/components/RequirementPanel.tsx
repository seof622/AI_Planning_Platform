"use client";

import type {
  AIModelOption,
  ReviewRecommendation,
} from "@ai-planning-platform/shared";
import type { BriefSaveStatus, PlanningBriefDraft } from "../store/planningStore";
import { WorkspaceIcon } from "./WorkspaceIcon";
import { criterionLabels, getReviewBlocker, planTypeLabels } from "../lib/planningInput";

const modelLevelLabels = {
  cost: { high: "높음", low: "낮음", medium: "보통" },
  quality: { high: "높음", highest: "최고", standard: "표준" },
  speed: { balanced: "균형", deliberate: "신중", fast: "빠름" },
} as const;

interface RequirementPanelProps {
  recommendation?: ReviewRecommendation | null;
  onOpenReview?: () => void;
  onOpenHistory?: () => void;
  hasReview?: boolean;
  briefSaveStatus?: BriefSaveStatus;
  briefSaveErrorMessage?: string | null;
  onRetryBriefSave?: () => Promise<void>;
  hasResult?: boolean;
  hasUnappliedInput?: boolean;
  isViewingHistoricalResult?: boolean;
  generatedModel?: string;
  hasSelectedProject: boolean;
  isLoading: boolean;
  loadingLabel?: string;
  onRetryModels?: () => Promise<void>;
  modelErrorMessage: string | null;
  models: AIModelOption[];
  modelStatus: "idle" | "loading" | "ready" | "error";
  onReview: () => Promise<void>;
  onReset: () => void;
  onShowError: () => void;
  planningBrief: PlanningBriefDraft;
  requirementText: string;
  selectedModel: string;
  setPlanningBriefField: <K extends keyof PlanningBriefDraft>(
    field: K,
    value: PlanningBriefDraft[K],
  ) => void;
  setRequirementText: (value: string) => void;
  setSelectedModel: (value: string) => void;
}

export function RequirementPanel({
  recommendation = null,
  onOpenReview,
  onOpenHistory,
  hasReview = false,
  briefSaveStatus = "idle",
  briefSaveErrorMessage = null,
  onRetryBriefSave,
  hasResult = false,
  hasUnappliedInput = false,
  isViewingHistoricalResult = false,
  generatedModel,
  hasSelectedProject,
  isLoading,
  loadingLabel = "작업 중",
  onRetryModels,
  modelErrorMessage,
  models,
  modelStatus,
  onReview,
  onReset,
  onShowError,
  planningBrief,
  requirementText,
  selectedModel,
  setPlanningBriefField,
  setRequirementText,
  setSelectedModel,
}: RequirementPanelProps) {
  const contextCount = planningBrief.context.filter(
    (item) => item.trim().length > 0,
  ).length;
  const actionCount = planningBrief.actionItems.filter(
    (item) => item.text.trim().length > 0,
  ).length;
  const requiredActionCount = planningBrief.actionItems.filter(
    (item) => item.necessity === "required" && item.text.trim().length > 0,
  ).length;
  const selectedModelOption = models.find(
    (model) => model.id === selectedModel,
  );
  const missingInput = getReviewBlocker({ hasSelectedProject, requirementText });
  const canSubmit = !isLoading && missingInput === null;
  const draftStatusText = !hasSelectedProject ? "프로젝트를 선택하면 입력 초안을 자동 저장합니다."
    : isViewingHistoricalResult ? "과거 버전 입력을 보는 중 · 자동 저장 일시 중지"
    : briefSaveStatus === "dirty" ? "입력 초안 자동 저장 대기 중"
    : briefSaveStatus === "saving" ? "입력 초안 자동 저장 중…"
    : briefSaveStatus === "saved" ? "입력 초안 자동 저장됨"
    : briefSaveStatus === "error" ? "입력 초안 자동 저장 실패"
    : "입력하면 초안을 자동 저장합니다.";
  const recommendedModel = models.find((model) => model.id === recommendation?.model);

  function updateContextItem(index: number, value: string) {
    setPlanningBriefField(
      "context",
      planningBrief.context.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    );
  }

  function addContextItem() {
    setPlanningBriefField("context", [...planningBrief.context, ""]);
  }

  function removeContextItem(index: number) {
    setPlanningBriefField(
      "context",
      planningBrief.context.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function updateActionItem(
    index: number,
    value: Partial<PlanningBriefDraft["actionItems"][number]>,
  ) {
    setPlanningBriefField(
      "actionItems",
      planningBrief.actionItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...value } : item,
      ),
    );
  }

  function addActionItem() {
    setPlanningBriefField("actionItems", [
      ...planningBrief.actionItems,
      { necessity: "required", text: "" },
    ]);
  }

  function removeActionItem(index: number) {
    setPlanningBriefField(
      "actionItems",
      planningBrief.actionItems.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  return (
    <aside className="panel panel--requirements">
      <div className="requirement-panel__heading">
        <h2 className="panel__title">계획 입력</h2>
        <div className={`brief-save${briefSaveStatus === "error" ? " brief-save--error" : ""}`} aria-label="입력 초안 저장 상태" title={draftStatusText}>
          <WorkspaceIcon name={briefSaveStatus === "error" ? "alert" : briefSaveStatus === "saving" ? "refresh" : briefSaveStatus === "saved" ? "cloud" : "clock"}
            className={briefSaveStatus === "saving" ? "workspace-icon--spin" : ""} />
          <span aria-hidden="true">초안</span><span className="sr-only" role="status">{draftStatusText}</span>
        </div>
      </div>
      <form
        className="requirement-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) void onReview();
        }}
      >
        <fieldset className="requirement-form__body" disabled={isLoading}>
          <label className="form-field">
            <span className="form-field__label">계획 주제 <span className="form-field__required" title="필수 입력"><span aria-hidden="true">*</span><span className="sr-only">필수</span></span></span>
            <textarea
              aria-label="계획 요구사항"
              id="planning-requirement"
              required
              value={requirementText}
              onChange={(event) => setRequirementText(event.target.value)}
              placeholder="무엇을 계획하고 싶나요?"
            />
          </label>

          <section className="form-field">
            <div className="form-field__header">
              <span className="form-field__label">상황 / 대상 <span className="form-field__hint">선택</span></span>
            </div>
            <div className="repeatable-list">
              {planningBrief.context.map((item, index) => (
                <div className="repeatable-row" key={index}>
                  <div className="repeatable-input-shell">
                    <input
                      aria-label={`상황 또는 대상 ${index + 1}`}
                      value={item}
                      onChange={(event) =>
                        updateContextItem(index, event.target.value)
                      }
                      placeholder={
                        index === 0
                          ? "예: 나 혼자, 가족 여행, 시험 준비"
                          : "추가 상황 또는 대상"
                      }
                    />
                    {index === planningBrief.context.length - 1 ? (
                      <div className="repeatable-inline-actions">
                        <button
                          aria-label="상황 또는 대상 추가"
                          className="icon-button"
                          type="button"
                          onClick={addContextItem}
                        >
                          +
                        </button>
                        <button
                          aria-label="상황 또는 대상 삭제"
                          className="icon-button icon-button--ghost"
                          disabled={planningBrief.context.length === 1}
                          type="button"
                          onClick={() => removeContextItem(index)}
                        >
                          -
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="form-field">
            <div className="form-field__header">
              <span className="form-field__label">해야 할 일 <span className="form-field__hint">선택 · AI와 보완 가능</span></span>
            </div>
            <div className="repeatable-list">
              {planningBrief.actionItems.map((item, index) => (
                <div className="repeatable-row repeatable-row--action" key={index}>
                  <div className="repeatable-input-shell">
                    <button
                      aria-label="해야 할 일 필수 여부"
                      aria-pressed={item.necessity === "required"}
                      title={item.necessity === "required" ? "반드시 할 일 · 클릭해서 선택 사항으로 변경" : "선택할 일 · 클릭해서 필수 사항으로 변경"}
                      className={`necessity-toggle necessity-toggle--${item.necessity}`}
                      type="button"
                      onClick={() =>
                        updateActionItem(index, {
                          necessity:
                            item.necessity === "required"
                              ? "optional"
                              : "required",
                        })
                      }
                    >
                      <WorkspaceIcon name={item.necessity === "required" ? "check" : "circle"} />
                    </button>
                    <input
                      aria-label={`해야 할 일 ${index + 1}`}
                      value={item.text}
                      onChange={(event) =>
                        updateActionItem(index, { text: event.target.value })
                      }
                      placeholder={index === 0 ? "예: 숙소 후보 정리" : "추가할 일"}
                    />
                    {index === planningBrief.actionItems.length - 1 ? (
                      <div className="repeatable-inline-actions">
                        <button
                          aria-label="해야 할 일 추가"
                          className="icon-button"
                          type="button"
                          onClick={addActionItem}
                        >
                          +
                        </button>
                        <button
                          aria-label="해야 할 일 삭제"
                          className="icon-button icon-button--ghost"
                          disabled={planningBrief.actionItems.length === 1}
                          type="button"
                          onClick={() => removeActionItem(index)}
                        >
                          -
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <details className="brief-options">
            <summary>세부 조건 <span>{planTypeLabels[planningBrief.planType]} · {criterionLabels[planningBrief.successCriterion]}{planningBrief.constraints.trim() ? " · 제약 있음" : ""}</span></summary>
            <div className="brief-options__fields">
              <div className="form-field-grid">
                <label className="form-field">
                  <span className="form-field__label">계획 유형</span>
                  <select
                    value={planningBrief.planType}
                    onChange={(event) =>
                      setPlanningBriefField(
                        "planType",
                        event.target.value as PlanningBriefDraft["planType"],
                      )
                    }
                  >
                    {Object.entries(planTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span className="form-field__label">중요 기준</span>
                  <select
                    value={planningBrief.successCriterion}
                    onChange={(event) =>
                      setPlanningBriefField(
                        "successCriterion",
                        event.target.value as PlanningBriefDraft["successCriterion"],
                      )
                    }
                  >
                    {Object.entries(criterionLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="form-field">
                <span className="form-field__label">제약 조건</span>
                <textarea
                  aria-label="제약 조건"
                  className="form-field__compact-textarea"
                  value={planningBrief.constraints}
                  onChange={(event) =>
                    setPlanningBriefField("constraints", event.target.value)
                  }
                  placeholder="시간, 예산, 장소, 체력, 함께하는 사람"
                />
              </label>
            </div>
          </details>

          <details className="requirement-summary" aria-label="입력 요약">
            <summary>입력 요약 <span>상황 {contextCount} · 할 일 {actionCount}</span></summary>
            <dl>
              <div>
                <dt>상황</dt>
                <dd>{contextCount}개</dd>
              </div>
              <div>
                <dt>유형</dt>
                <dd>{planTypeLabels[planningBrief.planType]}</dd>
              </div>
              <div>
                <dt>할 일</dt>
                <dd>
                  {actionCount}개 / 필수 {requiredActionCount}개
                </dd>
              </div>
              <div>
                <dt>기준</dt>
                <dd>{criterionLabels[planningBrief.successCriterion]}</dd>
              </div>
            </dl>
          </details>

          <details className="requirement-tools">
            <summary>기타 도구</summary>
            <div className="button-row" aria-label="MVP 상태 제어">
              <button className="button" type="button" onClick={onReset}>초기화</button>
              <button className="button" type="button" onClick={onShowError}>오류</button>
            </div>
          </details>

        </fieldset>
        <div className="requirement-form__footer">
            {briefSaveStatus === "error" && !isViewingHistoricalResult ? <div className="brief-save-error">
              <p className="form-field__error" role="alert">{briefSaveErrorMessage}</p>
              <button className="button" type="button" aria-label="입력 초안 저장 재시도" disabled={isLoading} onClick={() => void onRetryBriefSave?.()}><WorkspaceIcon name="refresh" />다시 저장</button>
            </div> : null}
          <div className="form-field">
            <label className="form-field__label" htmlFor="planning-model">AI 모델</label>
            <select
              id="planning-model"
              aria-label="AI 모델"
              disabled={isLoading || modelStatus !== "ready" || models.length === 0}
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
            >
              {models.length === 0 ? (
                <option value="">
                  {modelStatus === "loading"
                    ? "모델 목록을 불러오는 중"
                    : "사용 가능한 모델 없음"}
                </option>
              ) : null}
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                  {model.id === recommendation?.model ? " · 추천" : ""}
                </option>
              ))}
            </select>
            {modelErrorMessage ? (
              <span className="form-field__error" role="alert">
                {modelErrorMessage}
              </span>
            ) : null}
            {modelStatus === "error" && onRetryModels ? <button className="button" type="button" disabled={isLoading}
              onClick={() => void onRetryModels()}><WorkspaceIcon name="refresh" />모델 다시 불러오기</button> : null}
            <details className="model-details">
              <summary>모델 안내</summary>
              {recommendation && recommendedModel ? (
                <div className="model-recommendation" aria-label="추천 모델">
                  <span className="model-recommendation__badge">추천</span>
                  <p>
                    <strong>{recommendedModel.label}</strong>
                    <span>{recommendation.reason}</span>
                    {recommendation.uncertainty ? <span>{recommendation.uncertainty}</span> : null}
                  </p>
                </div>
              ) : null}
              {selectedModelOption ? (
                <section className="model-guidance" aria-label="선택 모델 안내">
                  <p className="model-guidance__description">
                    {selectedModelOption.description}
                  </p>
                  <dl className="model-guidance__levels">
                    <div><dt>품질</dt><dd>{modelLevelLabels.quality[selectedModelOption.quality]}</dd></div>
                    <div><dt>속도</dt><dd>{modelLevelLabels.speed[selectedModelOption.speed]}</dd></div>
                    <div><dt>비용</dt><dd>{modelLevelLabels.cost[selectedModelOption.cost]}</dd></div>
                  </dl>
                  <p className="model-guidance__recommendation">
                    <strong>추천:</strong> {selectedModelOption.recommendedFor}
                  </p>
                </section>
              ) : null}
              {generatedModel ? (
                <span className="form-field__hint">
                  최근 결과 모델: {generatedModel}
                </span>
              ) : null}
            </details>
          </div>

          <div className="generation-guidance" id="generation-guidance" aria-live="polite">
            {hasResult && hasUnappliedInput ? <p className="generation-guidance__changed" title="현재 입력은 아직 결과에 반영되지 않았습니다.">
              <WorkspaceIcon name="refresh" /><span>입력 변경됨</span><span className="sr-only">현재 입력은 아직 결과에 반영되지 않았습니다.</span>
            </p> : null}
            <p className={!isLoading && !missingInput ? "sr-only" : undefined}>{isLoading ? "현재 작업이 끝나면 검토할 수 있습니다." : missingInput ?? "AI 피드백과 모델을 확인한 뒤 계획을 생성합니다."}</p>
          </div>
          <button
            className="button button--primary"
            aria-describedby="generation-guidance"
            aria-label={isLoading ? loadingLabel : "AI 입력 검토"}
            title="AI가 입력을 검토하고 모델을 추천합니다."
            type="submit"
            disabled={!canSubmit}
          >
            <WorkspaceIcon name={isLoading ? "refresh" : hasResult ? "refresh" : "sparkle"} className={isLoading ? "workspace-icon--spin" : ""} />
            {isLoading ? loadingLabel : "AI 입력 검토"}
          </button>
          <div className="review-panel-links">
            {hasReview ? <button className="button" type="button" disabled={isLoading} onClick={onOpenReview}>검토 결과 보기</button> : null}
            <button className="button" type="button" disabled={!hasSelectedProject || isLoading} onClick={onOpenHistory}>검토·추천 이력</button>
          </div>
        </div>
      </form>
    </aside>
  );
}
