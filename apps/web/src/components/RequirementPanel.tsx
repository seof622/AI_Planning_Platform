"use client";

import type {
  QualityPriority,
  ServicePlatform,
} from "@ai-planning-platform/shared";
import type { PlanningBriefDraft } from "../store/planningStore";

const platformLabels: Record<ServicePlatform, string> = {
  api: "API / 백엔드",
  internal_tool: "내부 업무 도구",
  mobile: "모바일 앱",
  multi_platform: "여러 플랫폼",
  web: "웹 서비스",
};

const priorityLabels: Record<QualityPriority, string> = {
  cost: "비용 절감",
  scalability: "확장성",
  security: "보안",
  speed: "빠른 출시",
  stability: "안정성",
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
  const featureCount = planningBrief.mustHaveFeatures
    .split(/[\n,]/)
    .filter((feature) => feature.trim().length > 0).length;
  const canSubmit =
    requirementText.trim().length > 0 &&
    planningBrief.targetUsers.trim().length > 0 &&
    featureCount > 0;

  return (
    <aside className="panel panel--requirements">
      <h2 className="panel__title">요구사항</h2>
      <form
        className="requirement-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onLoadMock();
        }}
      >
        <label className="form-field">
          <span className="form-field__label">제품과 해결할 문제</span>
          <textarea
            aria-label="계획 요구사항"
            required
            value={requirementText}
            onChange={(event) => setRequirementText(event.target.value)}
            placeholder="무엇을 만들고 싶나요?"
          />
        </label>

        <label className="form-field">
          <span className="form-field__label">주요 사용자</span>
          <input
            required
            value={planningBrief.targetUsers}
            onChange={(event) =>
              setPlanningBriefField("targetUsers", event.target.value)
            }
            placeholder="예: 고객, 운영 관리자"
          />
        </label>

        <label className="form-field">
          <span className="form-field__label">핵심 기능</span>
          <textarea
            className="form-field__compact-textarea"
            required
            value={planningBrief.mustHaveFeatures}
            onChange={(event) =>
              setPlanningBriefField("mustHaveFeatures", event.target.value)
            }
            placeholder={"기능을 줄마다 입력하세요"}
          />
        </label>

        <div className="form-field-grid">
          <label className="form-field">
            <span className="form-field__label">서비스 형태</span>
            <select
              value={planningBrief.platform}
              onChange={(event) =>
                setPlanningBriefField(
                  "platform",
                  event.target.value as PlanningBriefDraft["platform"],
                )
              }
            >
              {Object.entries(platformLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-field__label">우선순위</span>
            <select
              value={planningBrief.qualityPriority}
              onChange={(event) =>
                setPlanningBriefField(
                  "qualityPriority",
                  event.target.value as PlanningBriefDraft["qualityPriority"],
                )
              }
            >
              {Object.entries(priorityLabels).map(([value, label]) => (
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
            placeholder="기술, 일정, 보안 또는 운영 제약"
          />
        </label>

        <section className="requirement-summary" aria-label="입력 요약">
          <h3>입력 요약</h3>
          <dl>
            <div>
              <dt>대상</dt>
              <dd>{planningBrief.targetUsers.trim() || "미입력"}</dd>
            </div>
            <div>
              <dt>형태</dt>
              <dd>{platformLabels[planningBrief.platform]}</dd>
            </div>
            <div>
              <dt>기능</dt>
              <dd>{featureCount}개</dd>
            </div>
            <div>
              <dt>우선</dt>
              <dd>{priorityLabels[planningBrief.qualityPriority]}</dd>
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
