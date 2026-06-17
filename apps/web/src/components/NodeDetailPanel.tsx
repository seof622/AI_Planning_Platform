"use client";

import type { ComponentNode } from "@ai-planning-platform/shared";
import { nodeTypeLabels, priorityLabels } from "../lib/planningLabels";

interface NodeDetailPanelProps {
  node: ComponentNode | null;
}

const metadataLabels: Record<string, string> = {
  owner: "담당",
};

export function NodeDetailPanel({ node }: NodeDetailPanelProps) {
  if (!node) {
    return (
      <aside className="panel">
        <h2 className="panel__title">노드 상세</h2>
        <p className="panel__description">
          캔버스에서 컴포넌트를 선택해 역할, 담당 영역, 우선순위, 메타데이터를
          확인하세요.
        </p>
        <div className="status-view">
          <div className="status-view__box">
            <h3 className="status-view__title">선택된 노드 없음</h3>
            <p className="status-view__copy">
              그래프를 살펴볼 준비가 되었습니다. 노드를 선택하면 해당 계획 계약을
              검토할 수 있습니다.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  const metadataEntries = Object.entries(node.metadata ?? {});

  return (
    <aside className="panel">
      <h2 className="panel__title">{node.label}</h2>
      <p className="panel__description">{node.description}</p>
      <div className="detail-list">
        <div className="detail-list__item">
          <p className="detail-list__label">유형</p>
          <p className="detail-list__value">{nodeTypeLabels[node.type]}</p>
        </div>
        <div className="detail-list__item">
          <p className="detail-list__label">분류</p>
          <p className="detail-list__value">{node.category}</p>
        </div>
        <div className="detail-list__item">
          <p className="detail-list__label">우선순위</p>
          <p className="detail-list__value">{priorityLabels[node.priority]}</p>
        </div>
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
    </aside>
  );
}
