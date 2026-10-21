"use client";

import type { DependencyType } from "@ai-planning-platform/shared";
import { dependencyLabels } from "../lib/planningLabels";
import { WorkspacePopover } from "./WorkspacePopover";
import { WorkspaceIcon } from "./WorkspaceIcon";
import { ResultSaveButton } from "./ResultSaveButton";

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
        <button className="button" type="button" aria-label="노드 추가" title="노드 추가" disabled={disabled} onClick={onAddNode}><WorkspaceIcon name="plus" />노드</button>
        <label className="graph-edit-panel__connection">
          <span title="연결 유형"><WorkspaceIcon name="link" /></span>
          <select aria-label="새 연결 유형" disabled={disabled} value={connectionType}
            onChange={(event) => onConnectionTypeChange(event.target.value as DependencyType)}>
            {Object.entries(dependencyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <WorkspacePopover label="연결 도움말" trigger={<WorkspaceIcon name="info" />} className="graph-edit-panel__help">
          <p className="graph-edit-panel__hint">노드 오른쪽 점을 다른 노드의 왼쪽 점으로 드래그하세요.</p>
          <p className="graph-edit-panel__hint">연결선을 클릭하면 유형 변경·삭제가 가능합니다. 선택한 연결선 끝을 다른 노드로 옮길 수도 있습니다.</p>
          <p className="graph-edit-panel__hint">현재 {edgeCount}개 연결</p>
          <p className="graph-edit-panel__hint">저장은 노드·연결·로드맵 편집 전체를 새 버전으로 기록합니다. 입력 초안은 별도로 자동 저장됩니다.</p>
        </WorkspacePopover>
        <ResultSaveButton disabled={disabled || !canSave} onSave={onSave} />
      </div>
      {errorMessage ? <p className="form-field__error" role="alert">{errorMessage}</p> : null}
    </section>
  );
}
