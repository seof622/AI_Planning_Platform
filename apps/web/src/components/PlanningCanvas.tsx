"use client";

import { useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import type { PlanningResult } from "@ai-planning-platform/shared";
import { ComponentNodeCard } from "./ComponentNodeCard";
import { LabeledDependencyEdge } from "./LabeledDependencyEdge";
import { StatusView } from "./StatusView";
import { toReactFlowEdges, toReactFlowNodes } from "../lib/reactFlowMapping";
import type { PlanningStatus } from "../store/planningStore";

interface PlanningCanvasProps {
  onSelectNode: (nodeId: string | null) => void;
  result: PlanningResult | null;
  selectedNodeId: string | null;
  status: PlanningStatus;
}

const nodeTypes = {
  componentNode: ComponentNodeCard,
};

const edgeTypes = {
  labeledDependency: LabeledDependencyEdge,
};

type NodeStyleWithAccent = Node["style"] & {
  "--node-accent"?: string;
};

export function PlanningCanvas({
  onSelectNode,
  result,
  selectedNodeId,
  status,
}: PlanningCanvasProps) {
  const nodes = useMemo(() => (result ? toReactFlowNodes(result) : []), [result]);
  const edges = useMemo(() => (result ? toReactFlowEdges(result) : []), [result]);

  const selectedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
      })),
    [nodes, selectedNodeId],
  );

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    onSelectNode(node.id);
  };

  if (status !== "ready" || !result) {
    return (
      <section className="canvas-shell">
        <StatusView status={status} />
      </section>
    );
  }

  return (
    <section className="canvas-shell" aria-label="계획 의존성 그래프">
      <ReactFlow
        nodes={selectedNodes}
        edges={edges}
        edgeTypes={edgeTypes}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={() => onSelectNode(null)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.45}
        maxZoom={1.4}
      >
        <Background gap={20} size={1} color="#d9e0e7" />
        <Controls position="bottom-left" />
        <MiniMap
          nodeColor={(node) => {
            const style = node.style as NodeStyleWithAccent | undefined;

            return typeof style?.["--node-accent"] === "string"
              ? style["--node-accent"]
              : "#64748b";
          }}
          pannable
          zoomable
        />
      </ReactFlow>
    </section>
  );
}
