"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { RoadmapStep } from "@ai-planning-platform/shared";
import { priorityLabels } from "../lib/planningLabels";
import type { PlanningStatus } from "../store/planningStore";
import { WorkspaceIcon } from "./WorkspaceIcon";
import { ResultSaveButton } from "./ResultSaveButton";

interface RoadmapPanelProps {
  hidden?: boolean;
  feedback?: ReactNode;
  disabled?: boolean;
  loadingLabel?: string;
  saveBlocked?: boolean;
  editErrorMessage: string | null;
  editStatus: "idle" | "dirty" | "saving" | "error";
  errorMessage: string | null;
  selectedStepId: string | null;
  onSelect: (stepId: string | null) => void;
  onAdd: () => void;
  onSave: () => Promise<void>;
  roadmap: RoadmapStep[];
  status: PlanningStatus;
}

export function RoadmapPanel({ hidden = false, feedback, disabled = false, loadingLabel = "불러오는 중", saveBlocked = false,
  editErrorMessage, editStatus, errorMessage, selectedStepId, onSelect, onAdd, onSave, roadmap, status,
}: RoadmapPanelProps) {
  const stepsRef = useRef<HTMLOListElement>(null);
  const sortedRoadmap = [...roadmap].sort((left, right) => left.order - right.order);
  const selectedOrder = roadmap.find((step) => step.id === selectedStepId)?.order;
  const orderById = new Map(roadmap.map((step) => [step.id, step.order]));
  const canSave = status === "ready" && !disabled && !saveBlocked
    && (editStatus === "dirty" || editStatus === "error")
    && roadmap.every((step) => step.title.trim() && step.description.trim());

  useEffect(() => {
    const list = stepsRef.current;
    const row = list && [...list.children].find((item) => (item as HTMLElement).dataset.stepId === selectedStepId) as HTMLElement | undefined;
    if (!list || !row) return;
    // Scroll just the list, keeping the editor and the page in place.
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
    }
  }, [selectedStepId, selectedOrder, hidden]);

  return <section className="roadmap" id="planning-roadmap" hidden={hidden} aria-label="계획 로드맵">
    <div className="roadmap__header">
      <h2 className="roadmap__title">로드맵</h2>
      <div className="roadmap__actions">
        <span className="pill">{roadmap.length}단계</span>
        <button className="button roadmap__save" type="button" aria-label="단계 추가" title="단계 추가"
          disabled={disabled || status !== "ready" || editStatus === "saving"} onClick={onAdd}>
          <WorkspaceIcon name="plus" />단계
        </button>
        <ResultSaveButton className="roadmap__save" disabled={!canSave} saving={editStatus === "saving"} onSave={onSave} />
      </div>
    </div>
    {feedback}
    {editErrorMessage ? <p className="form-field__error" role="alert">{editErrorMessage}</p> : null}
    {status !== "ready" ? <div className="status-view"><div className="status-view__box">
      <h3 className="status-view__title">{status === "loading" ? loadingLabel : "로드맵 없음"}</h3>
      {status === "error" ? <p className="status-view__copy">{errorMessage ?? "계획 결과를 불러올 수 없습니다."}</p> : null}
      {status === "empty" ? <p className="status-view__copy">계획을 생성하세요.</p> : null}
    </div></div> : <>
      {roadmap.length === 0 ? <p className="roadmap__empty">단계가 없습니다. 단계 추가로 로드맵을 만들어 보세요.</p> : null}
      <ol className="roadmap__steps" ref={stepsRef}>
        {sortedRoadmap.map((step) => <li className="roadmap-step" key={step.id} data-step-id={step.id}>
          <button className="roadmap-step__select" type="button"
            aria-label={`${step.order}단계 ${step.title.trim() || "제목 없음"} 편집`}
            aria-pressed={step.id === selectedStepId} aria-controls={step.id === selectedStepId ? "workspace-detail" : undefined}
            disabled={disabled || editStatus === "saving"}
            onClick={() => onSelect(step.id === selectedStepId ? null : step.id)}>
            <span className="roadmap-step__order" aria-hidden="true">{step.order}</span>
            <span className="roadmap-step__content">
              <span className="roadmap-step__title">{step.title.trim() || "제목 없음"}</span>
              <span className="roadmap-step__description">{step.description}</span>
              {step.dependsOn.length ? <span className="roadmap-step__dependencies">
                선행 {step.dependsOn.map((id) => orderById.get(id)).join(" · ")}
              </span> : null}
            </span>
            <span className={`pill pill--${step.priority}`} title={`우선순위 ${priorityLabels[step.priority]}`}>{priorityLabels[step.priority]}</span>
          </button>
        </li>)}
      </ol>
    </>}
  </section>;
}
