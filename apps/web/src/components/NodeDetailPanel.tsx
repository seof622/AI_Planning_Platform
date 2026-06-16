"use client";

import type { ComponentNode } from "@ai-planning-platform/shared";
import { nodeTypeLabels, priorityLabels } from "../lib/planningLabels";

interface NodeDetailPanelProps {
  node: ComponentNode | null;
}

export function NodeDetailPanel({ node }: NodeDetailPanelProps) {
  if (!node) {
    return (
      <aside className="panel">
        <h2 className="panel__title">Node detail</h2>
        <p className="panel__description">
          Select a component in the canvas to inspect its role, owner, priority,
          and metadata.
        </p>
        <div className="status-view">
          <div className="status-view__box">
            <h3 className="status-view__title">No node selected</h3>
            <p className="status-view__copy">
              The graph is ready for inspection. Pick any node to review the
              planning contract behind it.
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
          <p className="detail-list__label">Type</p>
          <p className="detail-list__value">{nodeTypeLabels[node.type]}</p>
        </div>
        <div className="detail-list__item">
          <p className="detail-list__label">Category</p>
          <p className="detail-list__value">{node.category}</p>
        </div>
        <div className="detail-list__item">
          <p className="detail-list__label">Priority</p>
          <p className="detail-list__value">{priorityLabels[node.priority]}</p>
        </div>
        <div className="detail-list__item">
          <p className="detail-list__label">Position</p>
          <p className="detail-list__value">
            x {node.position.x}, y {node.position.y}
          </p>
        </div>
        {metadataEntries.length > 0 ? (
          <div className="detail-list__item">
            <p className="detail-list__label">Metadata</p>
            <ul className="metadata-list">
              {metadataEntries.map(([key, value]) => (
                <li key={key}>
                  {key}: {String(value)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
