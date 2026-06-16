"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PlanningFlowNode } from "../lib/reactFlowMapping";
import { nodeTypeLabels, priorityLabels } from "../lib/planningLabels";

export function ComponentNodeCard({ data, selected }: NodeProps<PlanningFlowNode>) {
  return (
    <div className="custom-node" aria-selected={selected}>
      <Handle type="target" position={Position.Left} />
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
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
