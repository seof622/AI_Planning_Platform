"use client";

import type { RoadmapStep } from "@ai-planning-platform/shared";
import { effortLabels, priorityLabels } from "../lib/planningLabels";
import type { PlanningStatus } from "../store/planningStore";

interface RoadmapPanelProps {
  saveBlocked?: boolean;
  editErrorMessage: string | null;
  editStatus: "idle" | "dirty" | "saving" | "error";
  errorMessage: string | null;
  onChange: (
    stepId: string,
    changes: Partial<
      Pick<RoadmapStep, "title" | "description" | "priority" | "estimatedEffort">
    >,
  ) => void;
  onMove: (stepId: string, direction: -1 | 1) => void;
  onSave: () => Promise<void>;
  roadmap: RoadmapStep[];
  status: PlanningStatus;
}

export function RoadmapPanel({
  saveBlocked = false,
  editErrorMessage,
  editStatus,
  errorMessage,
  onChange,
  onMove,
  onSave,
  roadmap,
  status,
}: RoadmapPanelProps) {
  const sortedRoadmap = [...roadmap].sort((left, right) => left.order - right.order);
  const canSave =
    !saveBlocked && (editStatus === "dirty" || editStatus === "error") &&
    sortedRoadmap.every(
      (step) => step.title.trim() && step.description.trim(),
    );

  return (
    <section className="roadmap" aria-label="계획 로드맵">
      <div className="roadmap__header">
        <h2 className="roadmap__title">로드맵</h2>
        <div className="roadmap__actions">
          <span className="pill">{sortedRoadmap.length}단계</span>
          <button
            className="button button--primary roadmap__save"
            disabled={!canSave}
            type="button"
            onClick={() => void onSave()}
          >
            {editStatus === "saving" ? "저장 중" : "로드맵 새 버전 저장"}
          </button>
        </div>
      </div>

      {editErrorMessage ? (
        <p className="form-field__error" role="alert">{editErrorMessage}</p>
      ) : null}

      {status === "error" ? (
        <StatusViewCopy
          title="로드맵 없음"
          copy={errorMessage ?? "계획 결과를 불러올 수 없습니다."}
        />
      ) : null}

      {status === "empty" ? (
        <StatusViewCopy
          title="로드맵 없음"
          copy="계획을 생성하세요."
        />
      ) : null}

      {status === "loading" ? (
        <StatusViewCopy title="생성 중" copy="로드맵을 준비하고 있습니다." />
      ) : null}

      {status === "ready" ? (
        <fieldset className="roadmap__fields" disabled={editStatus === "saving"}>
        <ol className="roadmap__steps">
          {sortedRoadmap.map((step, index) => (
            <li className="roadmap-step" key={step.id}>
              <div className="roadmap-step__topline">
                <span className="roadmap-step__order">{step.order}</span>
                <div className="roadmap-step__move-actions">
                  <button aria-label={`${step.title} 앞으로 이동`} disabled={index === 0} type="button" onClick={() => onMove(step.id, -1)}>←</button>
                  <button aria-label={`${step.title} 뒤로 이동`} disabled={index === sortedRoadmap.length - 1} type="button" onClick={() => onMove(step.id, 1)}>→</button>
                </div>
              </div>
              <label className="form-field">
                <span className="form-field__label">단계 제목</span>
                <input aria-label={`${step.order}단계 제목`} value={step.title} onChange={(event) => onChange(step.id, { title: event.target.value })} />
              </label>
              <label className="form-field">
                <span className="form-field__label">단계 설명</span>
                <textarea aria-label={`${step.order}단계 설명`} value={step.description} onChange={(event) => onChange(step.id, { description: event.target.value })} />
              </label>
              <label className="form-field">
                <span className="form-field__label">우선순위</span>
                <select aria-label={`${step.order}단계 우선순위`} value={step.priority} onChange={(event) => onChange(step.id, { priority: event.target.value as RoadmapStep["priority"] })}>
                  {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span className="form-field__label">예상 작업량</span>
                <select aria-label={`${step.order}단계 예상 작업량`} value={step.estimatedEffort} onChange={(event) => onChange(step.id, { estimatedEffort: event.target.value as RoadmapStep["estimatedEffort"] })}>
                  {Object.entries(effortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </li>
          ))}
        </ol>
        </fieldset>
      ) : null}
    </section>
  );
}

function StatusViewCopy({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="status-view">
      <div className="status-view__box">
        <h3 className="status-view__title">{title}</h3>
        {copy ? <p className="status-view__copy">{copy}</p> : null}
      </div>
    </div>
  );
}
