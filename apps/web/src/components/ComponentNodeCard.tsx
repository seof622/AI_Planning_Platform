"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PlanningFlowNode } from "../lib/reactFlowMapping";
import { nodeTypeLabels, priorityLabels } from "../lib/planningLabels";

export function ComponentNodeCard({ data, selected }: NodeProps<PlanningFlowNode>) {
  return (
    <div className="custom-node" aria-selected={selected}>
      <Handle type="target" position={Position.Left} aria-label={`${data.label} 연결 도착점`} title="다른 노드의 연결을 여기에 놓으세요" />
      <div className="custom-node__body">
        <div className="custom-node__meta">
          <span className="pill">{nodeTypeLabels[data.type]}</span>
          <span className={`pill pill--${data.priority}`}>
            {priorityLabels[data.priority]}
          </span>
        </div>
        <h3 className="custom-node__title">{data.label}</h3>
        <p className="custom-node__description">{data.description}</p>
      </div>
      <Handle type="source" position={Position.Right} aria-label={`${data.label} 연결 시작점`} title="드래그해서 다른 노드에 연결" />
    </div>
  );
}
