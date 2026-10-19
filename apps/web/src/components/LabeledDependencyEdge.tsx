"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useViewport,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import type { DependencyType } from "@ai-planning-platform/shared";
import { dependencyLabels } from "../lib/planningLabels";

type EditableEdgeData = {
  dependencyType: DependencyType;
  disabled: boolean;
  onSelect: () => void;
  onChangeType: (type: DependencyType) => void;
  onDelete: () => void;
};

export function LabeledDependencyEdge({
  id,
  data,
  selected,
  label,
  markerEnd,
  sourcePosition,
  sourceX,
  sourceY,
  style,
  targetPosition,
  targetX,
  targetY,
}: EdgeProps<Edge<EditableEdgeData>>) {
  const { zoom } = useViewport();
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge id={id} markerEnd={markerEnd} path={edgePath} interactionWidth={28}
        style={{ ...style, ...(selected ? { strokeWidth: 4 } : {}) }} />
      {label ? (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`edge-label nodrag nopan${selected ? " edge-label--selected" : ""}`}
            aria-label={`연결 선택: ${label}`}
            aria-pressed={Boolean(selected)}
            data-edge-id={id}
            onClick={(event) => { event.stopPropagation(); data?.onSelect(); }}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label}
          </button>
        </EdgeLabelRenderer>
      ) : null}
      {selected && data ? (
        <EdgeLabelRenderer>
          <div className="edge-editor nodrag nopan" role="group" aria-label="연결 편집" data-edge-id={id}
            style={{ transformOrigin: "top left", transform: `translate(${labelX}px, ${labelY}px) scale(${1 / zoom}) translate(-50%, 18px)` }}
            onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
            <label>
              <span>연결 유형</span>
              <select aria-label="선택한 연결 유형" value={data.dependencyType} disabled={data.disabled}
                onChange={(event) => data.onChangeType(event.target.value as DependencyType)}>
                {Object.entries(dependencyLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            </label>
            <button className="button graph-delete" type="button" disabled={data.disabled} onClick={data.onDelete}>연결 삭제</button>
            <p>양 끝의 원을 드래그하면 연결 대상을 바꿀 수 있습니다.</p>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
