"use client";

import type { ComponentNode, RoadmapStep } from "@ai-planning-platform/shared";
import { effortLabels, priorityLabels } from "../lib/planningLabels";
import { ResultSaveButton } from "./ResultSaveButton";
import { WorkspaceIcon } from "./WorkspaceIcon";

type StepChanges = Partial<Pick<RoadmapStep, "title" | "description" | "priority" | "estimatedEffort" | "dependsOn" | "componentNodeIds">>;

interface RoadmapStepDetailPanelProps {
  step: RoadmapStep | null;
  roadmap: RoadmapStep[];
  nodes: ComponentNode[];
  disabled: boolean;
  saveBlocked: boolean;
  editStatus: "idle" | "dirty" | "saving" | "error";
  errorMessage: string | null;
  onClose: () => void;
  onChange: (stepId: string, changes: StepChanges) => void;
  onMove: (stepId: string, direction: -1 | 1) => void;
  onDelete: (stepId: string) => void;
  onSave: () => Promise<void>;
}

export function RoadmapStepDetailPanel({ step, roadmap, nodes, disabled, saveBlocked, editStatus, errorMessage,
  onClose, onChange, onMove, onDelete, onSave,
}: RoadmapStepDetailPanelProps) {
  if (!step) return null;
  const sorted = [...roadmap].sort((left, right) => left.order - right.order);
  const index = sorted.findIndex((item) => item.id === step.id);
  const locked = disabled || editStatus === "saving";
  const canSave = !locked && !saveBlocked && (editStatus === "dirty" || editStatus === "error")
    && roadmap.every((item) => item.title.trim() && item.description.trim());

  return <aside className="detail-drawer detail-drawer--open roadmap-step-editor" id="workspace-detail" aria-label="로드맵 단계 편집">
    <div className="detail-drawer__header">
      <h2 className="panel__title">단계 편집 <span className="pill">{step.order}</span></h2>
      <button type="button" aria-label="단계 편집 닫기" title="단계 편집 닫기" onClick={onClose}><WorkspaceIcon name="close" /></button>
    </div>
    <fieldset className="detail-list roadmap-step-editor__fields" disabled={locked}>
      <label className="form-field">
        <span className="form-field__label">제목</span>
        <input aria-label={`${step.order}단계 제목`} value={step.title} onChange={(event) => onChange(step.id, { title: event.target.value })} />
      </label>
      <label className="form-field">
        <span className="form-field__label">설명</span>
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
      <details className="roadmap-step__references">
        <summary>관련 노드 · {step.componentNodeIds?.length ?? 0}개</summary>
        <fieldset aria-label={`${step.order}단계 관련 노드`} className="roadmap-step__choices">
          {nodes.map((node) => <label className="roadmap-step__choice" key={node.id}>
            <input type="checkbox" aria-label={`${step.order}단계 관련 노드: ${node.label}`} checked={step.componentNodeIds?.includes(node.id) ?? false}
              onChange={(event) => onChange(step.id, { componentNodeIds: event.target.checked
                ? [...(step.componentNodeIds ?? []), node.id] : (step.componentNodeIds ?? []).filter((id) => id !== node.id) })} />
            <span>{node.label}</span>
          </label>)}
        </fieldset>
      </details>
      <details className="roadmap-step__references">
        <summary>선행 단계 · {step.dependsOn.length}개</summary>
        <p className="graph-edit-panel__hint">선행 단계를 먼저 실행하도록 순서를 자동 조정합니다.</p>
        <fieldset aria-label={`${step.order}단계 선행 단계`} className="roadmap-step__choices">
          {sorted.filter((item) => item.id !== step.id).map((dependency) => <label className="roadmap-step__choice" key={dependency.id}>
            <input type="checkbox" aria-label={`${step.order}단계 선행 단계: ${dependency.title}`} checked={step.dependsOn.includes(dependency.id)}
              onChange={(event) => onChange(step.id, { dependsOn: event.target.checked
                ? [...step.dependsOn, dependency.id] : step.dependsOn.filter((id) => id !== dependency.id) })} />
            <span>{dependency.order}. {dependency.title}</span>
          </label>)}
          {sorted.length === 1 ? <p className="graph-edit-panel__hint">다른 단계를 추가하면 선행 조건을 설정할 수 있습니다.</p> : null}
        </fieldset>
      </details>
      <div className="roadmap-step-editor__order-actions">
        <button className="button" aria-label={`${step.title} 앞으로 이동`} disabled={index === 0} type="button" onClick={() => onMove(step.id, -1)}>↑ 위로</button>
        <button className="button" aria-label={`${step.title} 뒤로 이동`} disabled={index === sorted.length - 1} type="button" onClick={() => onMove(step.id, 1)}>↓ 아래로</button>
      </div>
    </fieldset>
    {errorMessage ? <p className="form-field__error" role="alert">{errorMessage}</p> : null}
    <ResultSaveButton className="detail-drawer__save" disabled={!canSave} saving={editStatus === "saving"} onSave={onSave} />
    <button className="button graph-delete" type="button" aria-label={`${step.title} 단계 삭제`} disabled={locked} onClick={() => onDelete(step.id)}>
      <WorkspaceIcon name="trash" />단계 삭제
    </button>
  </aside>;
}
