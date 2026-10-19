"use client";

import { useRef } from "react";
import type { ComponentNode, RoadmapStep } from "@ai-planning-platform/shared";
import { effortLabels, priorityLabels } from "../lib/planningLabels";
import type { PlanningStatus } from "../store/planningStore";

interface RoadmapPanelProps {
  saveBlocked?: boolean;
  editErrorMessage: string | null;
  editStatus: "idle" | "dirty" | "saving" | "error";
  errorMessage: string | null;
  nodes: ComponentNode[];
  onAdd: () => void;
  onDelete: (stepId: string) => void;
  onChange: (
    stepId: string,
    changes: Partial<
      Pick<RoadmapStep, "title" | "description" | "priority" | "estimatedEffort" | "dependsOn" | "componentNodeIds">
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
  nodes,
  onAdd,
  onDelete,
  onChange,
  onMove,
  onSave,
  roadmap,
  status,
}: RoadmapPanelProps) {
  const stepsRef = useRef<HTMLOListElement>(null);
  const sortedRoadmap = [...roadmap].sort((left, right) => left.order - right.order);
  const canSave =
    status === "ready" && !saveBlocked && (editStatus === "dirty" || editStatus === "error") &&
    sortedRoadmap.every(
      (step) => step.title.trim() && step.description.trim(),
    );

  return (
    <section className="roadmap" aria-label="계획 로드맵">
      <div className="roadmap__header">
        <h2 className="roadmap__title">로드맵</h2>
        <div className="roadmap__actions">
          <span className="pill">{sortedRoadmap.length}단계</span>
          <button className="button roadmap__save" type="button" disabled={status !== "ready" || editStatus === "saving"}
            onClick={() => {
              onAdd();
              requestAnimationFrame(() => stepsRef.current?.lastElementChild?.scrollIntoView?.({ block: "nearest", inline: "end" }));
            }}>단계 추가</button>
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
        {sortedRoadmap.length === 0 ? <p className="roadmap__empty">단계가 없습니다. 단계 추가로 로드맵을 만들어 보세요.</p> : null}
        <ol className="roadmap__steps" ref={stepsRef}>
          {sortedRoadmap.map((step, index) => (
            <li className="roadmap-step" key={step.id} data-step-id={step.id}>
              <div className="roadmap-step__topline">
                <span className="roadmap-step__order">{step.order}</span>
                <div className="roadmap-step__move-actions">
                  <button aria-label={`${step.title} 앞으로 이동`} disabled={index === 0} type="button" onClick={() => onMove(step.id, -1)}>←</button>
                  <button aria-label={`${step.title} 뒤로 이동`} disabled={index === sortedRoadmap.length - 1} type="button" onClick={() => onMove(step.id, 1)}>→</button>
                  <button className="graph-delete" aria-label={`${step.title} 단계 삭제`} type="button" onClick={() => onDelete(step.id)}>삭제</button>
                </div>
              </div>
              <label className="form-field">
                <span className="form-field__label">단계 제목</span>
                <input aria-label={`${step.order}단계 제목`} value={step.title} onChange={(event) => onChange(step.id, { title: event.target.value })} />
              </label>
              <details className="roadmap-step__references">
                <summary>관련 노드 · {step.componentNodeIds?.length ?? 0}개</summary>
                <fieldset aria-label={`${step.order}단계 관련 노드`} className="roadmap-step__choices">
                  {nodes.map((node) => (
                    <label className="roadmap-step__choice" key={node.id}>
                      <input type="checkbox" aria-label={`${step.order}단계 관련 노드: ${node.label}`}
                        checked={step.componentNodeIds?.includes(node.id) ?? false}
                        onChange={(event) => onChange(step.id, { componentNodeIds: event.target.checked
                          ? [...(step.componentNodeIds ?? []), node.id] : (step.componentNodeIds ?? []).filter((id) => id !== node.id) })} />
                      <span>{node.label}</span>
                    </label>
                  ))}
                </fieldset>
              </details>
              <details className="roadmap-step__references">
                <summary>선행 단계 · {step.dependsOn.length}개</summary>
                <p className="graph-edit-panel__hint">선행 단계를 먼저 실행하도록 순서를 자동 조정합니다.</p>
                <fieldset aria-label={`${step.order}단계 선행 단계`} className="roadmap-step__choices">
                  {sortedRoadmap.filter((item) => item.id !== step.id).map((dependency) => (
                    <label className="roadmap-step__choice" key={dependency.id}>
                      <input type="checkbox" aria-label={`${step.order}단계 선행 단계: ${dependency.title}`}
                        checked={step.dependsOn.includes(dependency.id)}
                        onChange={(event) => onChange(step.id, { dependsOn: event.target.checked
                          ? [...step.dependsOn, dependency.id] : step.dependsOn.filter((id) => id !== dependency.id) })} />
                      <span>{dependency.order}. {dependency.title}</span>
                    </label>
                  ))}
                  {sortedRoadmap.length === 1 ? <p className="graph-edit-panel__hint">다른 단계를 추가하면 선행 조건을 설정할 수 있습니다.</p> : null}
                </fieldset>
              </details>
              <label className="form-field">
                <span className="form-field__label">단계 설명</span>
                <textarea aria-label={`${step.order}단계 설명`} value={step.description} onChange={(event) => onChange(step.id, { description: event.target.value })} />
              </label>
              <div className="roadmap-step__attributes">
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
              </div>
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
