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
  const [showMiniMap, setShowMiniMap] = useState(false);
  const shellRef = useRef<HTMLElement>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const reconnectingEdgeId = useRef<string | null>(null);
  const nodes = useMemo(() => (result ? toReactFlowNodes(result) : []), [result]);
  const edges = useMemo(() => (result ? toReactFlowEdges(result) : []), [result]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => { void flow?.fitView({ padding: 0.14 }); });
    return () => cancelAnimationFrame(frame);
  }, [flow, nodes.length]);
  useEffect(() => {
    if (!flow || !shellRef.current) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { void flow.fitView({ padding: 0.14 }); });
    });
    observer.observe(shellRef.current);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [flow]);

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
      <section className="canvas-shell" ref={shellRef}>
        <StatusView status={status} />
      </section>
    );
  }

  return (
    <section className="canvas-shell" ref={shellRef} aria-label="계획 의존성 그래프">
      <div className="canvas-heading">
        <div><span className="canvas-heading__eyebrow">PLAN OVERVIEW</span><h2>구조 캔버스</h2></div>
        <div className="canvas-heading__tools">
          <span className="canvas-heading__count">{result.nodes.length}개 노드<span aria-hidden="true"> · </span>{result.edges.length}개 연결</span>
          <button className="canvas-heading__map-toggle" type="button" aria-label={showMiniMap ? "미니맵 숨기기" : "미니맵 표시"} aria-pressed={showMiniMap}
            onClick={() => setShowMiniMap((value) => !value)}>미니맵</button>
        </div>
      </div>
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
        fitViewOptions={{ padding: 0.14 }}
        minZoom={0.25}
        maxZoom={1.4}
      >
        <Background gap={24} size={1} color="#cfd8d2" />
        <Controls position="bottom-left" />
        {showMiniMap ? <MiniMap
          style={{ width: 128, height: 80 }}
          maskColor="rgba(242, 245, 241, 0.6)"
          nodeColor={(node) => {
            const style = node.style as NodeStyleWithAccent | undefined;

            return typeof style?.["--node-accent"] === "string"
              ? style["--node-accent"]
              : "#64748b";
          }}
          pannable
          zoomable
        /> : null}
      </ReactFlow>
    </section>
  );
}
