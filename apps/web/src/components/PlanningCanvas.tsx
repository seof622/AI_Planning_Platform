"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Node,
  type NodeMouseHandler,
  type ReactFlowProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import type { DependencyEdge, DependencyType, PlanningResult } from "@ai-planning-platform/shared";
import { ComponentNodeCard } from "./ComponentNodeCard";
import { LabeledDependencyEdge } from "./LabeledDependencyEdge";
import { StatusView } from "./StatusView";
import { toReactFlowEdges, toReactFlowNodes } from "../lib/reactFlowMapping";
import type { PlanningStatus } from "../store/planningStore";

interface PlanningCanvasProps {
  disabled?: boolean;
  onConnect: (source: string, target: string) => void;
  onUpdateEdge: (edgeId: string, changes: Partial<Pick<DependencyEdge, "source" | "target" | "dependencyType">>) => void;
  onRemoveEdge: (edgeId: string) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
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
  disabled = false,
  onConnect,
  onUpdateEdge,
  onRemoveEdge,
  onSelectNode,
  onMoveNode,
  result,
  selectedNodeId,
  status,
}: PlanningCanvasProps) {
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const reconnectingEdgeId = useRef<string | null>(null);
  const nodes = useMemo(() => (result ? toReactFlowNodes(result) : []), [result]);
  const edges = useMemo(() => (result ? toReactFlowEdges(result) : []), [result]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => { void flow?.fitView({ padding: 0.2 }); });
    return () => cancelAnimationFrame(frame);
  }, [flow, nodes.length]);

  const selectedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
      })),
    [nodes, selectedNodeId],
  );

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    setSelectedEdgeId(null);
    onSelectNode(node.id);
  };
  function selectEdge(edgeId: string) {
    setSelectedEdgeId(edgeId);
    onSelectNode(null);
  }
  const editableEdges = edges.map((edge) => ({
    ...edge,
    selected: !selectedNodeId && edge.id === selectedEdgeId,
    reconnectable: !disabled && !selectedNodeId && edge.id === selectedEdgeId,
    data: {
      dependencyType: result!.edges.find((item) => item.id === edge.id)!.dependencyType,
      disabled,
      onSelect: () => selectEdge(edge.id),
      onChangeType: (type: DependencyType) => onUpdateEdge(edge.id, { dependencyType: type }),
      onDelete: () => { onRemoveEdge(edge.id); setSelectedEdgeId(null); },
    },
  }));
  const handleNodeDragStop: NonNullable<
    ReactFlowProps["onNodeDragStop"]
  > = (_event, node) => {
    onMoveNode(node.id, node.position.x, node.position.y);
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
        onInit={setFlow}
        nodesDraggable={!disabled}
        nodesConnectable={!disabled}
        deleteKeyCode={null}
        onConnect={(connection) => onConnect(connection.source, connection.target)}
        edgesReconnectable={!disabled}
        reconnectRadius={16}
        onReconnectStart={(_event, edge) => { reconnectingEdgeId.current = edge.id; selectEdge(edge.id); }}
        onReconnectEnd={() => { reconnectingEdgeId.current = null; }}
        onReconnect={(edge, connection) => onUpdateEdge(edge.id, { source: connection.source, target: connection.target })}
        isValidConnection={(connection) => {
          if (disabled || !connection.source || !connection.target || connection.source === connection.target) return false;
          const reconnecting = result.edges.find((edge) => edge.id === reconnectingEdgeId.current);
          return !result.edges.some((edge) => edge.id !== reconnecting?.id && edge.source === connection.source && edge.target === connection.target);
        }}
        nodes={selectedNodes}
        edges={editableEdges}
        edgeTypes={edgeTypes}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={(_event, edge) => selectEdge(edge.id)}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={() => { onSelectNode(null); setSelectedEdgeId(null); }}
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
