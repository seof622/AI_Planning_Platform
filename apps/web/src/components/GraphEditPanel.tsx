"use client";

import type { DependencyType } from "@ai-planning-platform/shared";
import { dependencyLabels } from "../lib/planningLabels";
import { WorkspacePopover } from "./WorkspacePopover";

interface GraphEditPanelProps {
  edgeCount: number;
  connectionType: DependencyType;
  onConnectionTypeChange: (type: DependencyType) => void;
  disabled: boolean;
  canSave: boolean;
  errorMessage: string | null;
  onAddNode: () => void;
  onSave: () => Promise<void>;
}

export function GraphEditPanel({ edgeCount, connectionType, onConnectionTypeChange, disabled, canSave, errorMessage, onAddNode, onSave }: GraphEditPanelProps) {
  return (
    <section className="graph-edit-panel" aria-label="그래프 구조 편집">
      <div className="graph-edit-panel__actions">
        <button className="button" type="button" disabled={disabled} onClick={onAddNode}>노드 추가</button>
        <label className="graph-edit-panel__connection">
          <span>연결 유형</span>
          <select aria-label="새 연결 유형" disabled={disabled} value={connectionType}
            onChange={(event) => onConnectionTypeChange(event.target.value as DependencyType)}>
            {Object.entries(dependencyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <WorkspacePopover label="연결 도움말" className="graph-edit-panel__help">
          <p className="graph-edit-panel__hint">노드 오른쪽 점을 다른 노드의 왼쪽 점으로 드래그하세요.</p>
          <p className="graph-edit-panel__hint">연결선을 클릭하면 유형 변경·삭제가 가능합니다. 선택한 연결선 끝을 다른 노드로 옮길 수도 있습니다.</p>
          <p className="graph-edit-panel__hint">현재 {edgeCount}개 연결</p>
        </WorkspacePopover>
        <button className="button button--primary" type="button" disabled={disabled || !canSave} onClick={() => void onSave()}>그래프 새 버전 저장</button>
      </div>
      {errorMessage ? <p className="form-field__error" role="alert">{errorMessage}</p> : null}
    </section>
  );
}
