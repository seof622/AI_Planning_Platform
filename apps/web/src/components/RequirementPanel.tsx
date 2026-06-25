"use client";

import type {
  PlanType,
  SuccessCriterion,
} from "@ai-planning-platform/shared";
import type { PlanningBriefDraft } from "../store/planningStore";

const planTypeLabels: Record<PlanType, string> = {
  creative: "창작 / 아이디어",
  daily: "일상 / 루틴",
  decision: "선택 / 의사결정",
  event: "행사 / 여행",
  learning: "학습 / 성장",
  project: "프로젝트",
};

const criterionLabels: Record<SuccessCriterion, string> = {
  balance: "균형",
  clarity: "명확함",
  consistency: "꾸준함",
  quality: "완성도",
  speed: "빠른 실행",
};

interface RequirementPanelProps {
  isLoading: boolean;
  onLoadMock: () => Promise<void>;
  onReset: () => void;
  onShowError: () => void;
  planningBrief: PlanningBriefDraft;
  requirementText: string;
  setPlanningBriefField: <K extends keyof PlanningBriefDraft>(
    field: K,
    value: PlanningBriefDraft[K],
  ) => void;
  setRequirementText: (value: string) => void;
}

export function RequirementPanel({
  isLoading,
  onLoadMock,
  onReset,
  onShowError,
  planningBrief,
  requirementText,
  setPlanningBriefField,
  setRequirementText,
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
  const canSubmit =
    requirementText.trim().length > 0 &&
    contextCount > 0 &&
    actionCount > 0;

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
      { necessity: "optional", text: "" },
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
      <h2 className="panel__title">계획 입력</h2>
      <form
        className="requirement-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onLoadMock();
        }}
      >
        <label className="form-field">
          <span className="form-field__label">계획 주제</span>
          <textarea
            aria-label="계획 요구사항"
            required
            value={requirementText}
            onChange={(event) => setRequirementText(event.target.value)}
            placeholder="무엇을 계획하고 싶나요?"
          />
        </label>

        <section className="form-field">
          <div className="form-field__header">
            <span className="form-field__label">상황 / 대상</span>
          </div>
          <div className="repeatable-list">
            {planningBrief.context.map((item, index) => (
              <div className="repeatable-row" key={index}>
                <div className="repeatable-input-shell">
                  <input
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
            <span className="form-field__label">해야 할 일</span>
          </div>
          <div className="repeatable-list">
            {planningBrief.actionItems.map((item, index) => (
              <div className="repeatable-row repeatable-row--action" key={index}>
                <div className="repeatable-input-shell">
                  <input
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
                <select
                  aria-label="해야 할 일 구분"
                  value={item.necessity}
                  onChange={(event) =>
                    updateActionItem(index, {
                      necessity: event.target
                        .value as PlanningBriefDraft["actionItems"][number]["necessity"],
                    })
                  }
                >
                  <option value="required">필수</option>
                  <option value="optional">선택</option>
                </select>
              </div>
            ))}
          </div>
        </section>

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
            className="form-field__compact-textarea"
            value={planningBrief.constraints}
            onChange={(event) =>
              setPlanningBriefField("constraints", event.target.value)
            }
            placeholder="시간, 예산, 장소, 체력, 함께하는 사람"
          />
        </label>

        <section className="requirement-summary" aria-label="입력 요약">
          <h3>입력 요약</h3>
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
        </section>

        <button
          className="button button--primary"
          type="submit"
          disabled={isLoading || !canSubmit}
        >
          {isLoading ? "생성 중" : "계획 생성"}
        </button>
      </form>
      <div className="button-row" aria-label="MVP 상태 제어">
        <button className="button" type="button" onClick={onReset}>
          초기화
        </button>
        <button className="button" type="button" onClick={onShowError}>
          오류
        </button>
      </div>
    </aside>
  );
}
