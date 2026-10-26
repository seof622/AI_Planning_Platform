"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Background,
  Controls,
  ControlButton,
  MiniMap,
  ReactFlow,
  useNodes,
  useNodesState,
  useNodesInitialized,
  useReactFlow,
  type Node,
  type NodeMouseHandler,
  type ReactFlowProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import type { DependencyEdge, DependencyType, PlanningResult } from "@ai-planning-platform/shared";
import { ComponentNodeCard } from "./ComponentNodeCard";
import { LabeledDependencyEdge } from "./LabeledDependencyEdge";
import { StatusView } from "./StatusView";
import { WorkspaceIcon } from "./WorkspaceIcon";
import { toReactFlowEdges, toReactFlowNodes } from "../lib/reactFlowMapping";
import type { PlanningStatus } from "../store/planningStore";

interface PlanningCanvasProps {
  resultRevision: number;
  hidden?: boolean;
  toolbar?: ReactNode;
  feedback?: ReactNode;
  errorMessage?: string | null;
  onStart?: () => void;
  hasSelectedProject?: boolean;
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

// Wait for measured nodes and a visible canvas before fitting a new result once.
function FitNewResult({ revision, hidden, nodes }: { revision: number; hidden: boolean; nodes: Node[] }) {
  const currentNodes = useNodes();
  const initialized = useNodesInitialized();
  const { fitView, viewportInitialized } = useReactFlow();
  const fittedRevision = useRef<number | null>(null);
  useEffect(() => {
    // The external result can render before React Flow has adopted its positions.
    if (currentNodes !== nodes || !initialized || !viewportInitialized || hidden || fittedRevision.current === revision) return;
    const frame = requestAnimationFrame(() => {
      fittedRevision.current = revision;
      void fitView({ padding: 0.14, maxZoom: 1.4 });
    });
    return () => cancelAnimationFrame(frame);
  }, [currentNodes, nodes, initialized, viewportInitialized, hidden, revision, fitView]);
  return null;
}

export function PlanningCanvas({
  resultRevision,
  hidden = false,
  toolbar,
  feedback,
  errorMessage,
  onStart,
  hasSelectedProject,
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
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node>(nodes);
  useEffect(() => {
    // Keep React Flow's measured dimensions and live drag state out of saved data.
    setFlowNodes((previous) => {
      const measured = new Map(previous.map((node) => [node.id, node.measured]));
      return nodes.map((node) => ({ ...node, measured: measured.get(node.id), selected: node.id === selectedNodeId }));
    });
  }, [nodes, selectedNodeId, setFlowNodes]);
  useEffect(() => {
    const viewport = shellRef.current?.querySelector<HTMLElement>(".react-flow");
    if (!flow || !viewport) return;
    let previous: { width: number; height: number } | null = null;
    const observer = new ResizeObserver(() => {
      const width = viewport.clientWidth, height = viewport.clientHeight;
      if (!width || !height) return;
      if (previous) {
        const current = flow.getViewport();
        void flow.setViewport({ ...current, x: current.x + (width - previous.width) / 2,
          y: current.y + (height - previous.height) / 2 });
      }
      previous = { width, height };
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [flow]);

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
      <section className="canvas-shell" id="planning-canvas" hidden={hidden} ref={shellRef}>
        {feedback ?? <StatusView status={status} errorMessage={errorMessage} onStart={onStart} hasSelectedProject={hasSelectedProject} />}
      </section>
    );
  }

  return (
    <section className="canvas-shell" id="planning-canvas" hidden={hidden} ref={shellRef} aria-label="계획 의존성 그래프">
      <div className="canvas-heading">
        <div><h2>구조 캔버스</h2></div>
        <div className="canvas-heading__tools">
          <span className="canvas-heading__count">{result.nodes.length}개 노드<span aria-hidden="true"> · </span>{result.edges.length}개 연결</span>
          <button className="canvas-heading__map-toggle" type="button" aria-label={showMiniMap ? "미니맵 숨기기" : "미니맵 표시"} aria-pressed={showMiniMap}
            title={showMiniMap ? "미니맵 숨기기" : "미니맵 표시"} onClick={() => setShowMiniMap((value) => !value)}><WorkspaceIcon name="map" /></button>
        </div>
      </div>
      {toolbar}
      {feedback}
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
        nodes={flowNodes}
        onNodesChange={(changes) => {
          onNodesChange(changes);
          for (const change of changes) {
            if (change.type === "position" && change.position && change.dragging === false) {
              onMoveNode(change.id, change.position.x, change.position.y);
            }
          }
        }}
        edges={editableEdges}
        edgeTypes={edgeTypes}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={(_event, edge) => selectEdge(edge.id)}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={() => { onSelectNode(null); setSelectedEdgeId(null); }}
        minZoom={0.25}
        maxZoom={1.4}
      >
        <FitNewResult revision={resultRevision} hidden={hidden} nodes={flowNodes} />
        <Background gap={24} size={1} color="#cfd8d2" />
        <Controls position="bottom-left" showFitView={false}>
          <ControlButton aria-label="전체 보기" title="전체 보기" onClick={() => { void flow?.fitView({ padding: 0.14, maxZoom: 1.4 }); }}>
            <WorkspaceIcon name="fit" />
          </ControlButton>
        </Controls>
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
