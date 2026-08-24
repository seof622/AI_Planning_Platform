"use client";

import type { ComponentNode } from "@ai-planning-platform/shared";
import { nodeTypeLabels, priorityLabels } from "../lib/planningLabels";

interface NodeDetailPanelProps {
  editErrorMessage: string | null;
  editStatus: "idle" | "dirty" | "saving" | "error";
  node: ComponentNode | null;
  onChange: (
    changes: Partial<
      Pick<ComponentNode, "label" | "description" | "category" | "priority">
    >,
  ) => void;
  onSave: () => Promise<void>;
}

const metadataLabels: Record<string, string> = {
  owner: "담당",
};

export function NodeDetailPanel({
  editErrorMessage,
  editStatus,
  node,
  onChange,
  onSave,
}: NodeDetailPanelProps) {
  if (!node) {
    return <aside className="detail-drawer" aria-hidden="true" />;
  }

  const metadataEntries = Object.entries(node.metadata ?? {});
  const canSave =
    editStatus === "dirty" &&
    node.label.trim().length > 0 &&
    node.description.trim().length > 0 &&
    node.category.trim().length > 0;

  return (
    <aside className="detail-drawer detail-drawer--open">
      <h2 className="panel__title">Node 편집</h2>
      <div className="detail-list">
        <label className="form-field">
          <span className="form-field__label">이름</span>
          <input
            aria-label="Node 이름"
            value={node.label}
            onChange={(event) => onChange({ label: event.target.value })}
          />
        </label>
        <label className="form-field">
          <span className="form-field__label">설명</span>
          <textarea
            aria-label="Node 설명"
            value={node.description}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        </label>
        <div className="detail-list__item">
          <p className="detail-list__label">유형</p>
          <p className="detail-list__value">{nodeTypeLabels[node.type]}</p>
        </div>
        <label className="form-field">
          <span className="form-field__label">분류</span>
          <input
            aria-label="Node 분류"
            value={node.category}
            onChange={(event) => onChange({ category: event.target.value })}
          />
        </label>
        <label className="form-field">
          <span className="form-field__label">우선순위</span>
          <select
            aria-label="Node 우선순위"
            value={node.priority}
            onChange={(event) =>
              onChange({ priority: event.target.value as ComponentNode["priority"] })
            }
          >
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <div className="detail-list__item">
          <p className="detail-list__label">위치</p>
          <p className="detail-list__value">
            x {node.position.x}, y {node.position.y}
          </p>
        </div>
        {metadataEntries.length > 0 ? (
          <div className="detail-list__item">
            <p className="detail-list__label">메타데이터</p>
            <ul className="metadata-list">
              {metadataEntries.map(([key, value]) => (
                <li key={key}>
                  {metadataLabels[key] ?? key}: {String(value)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {editErrorMessage ? (
        <p className="form-field__error" role="alert">{editErrorMessage}</p>
      ) : null}
      <button
        className="button button--primary detail-drawer__save"
        disabled={!canSave}
        type="button"
        onClick={() => void onSave()}
      >
        {editStatus === "saving" ? "저장 중" : "편집본 새 버전 저장"}
      </button>
    </aside>
  );
}
