"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { useCardDoubleTap, useContentReader } from "./ContentReader";
import { LabeledDependencyEdge } from "./LabeledDependencyEdge";
import { StatusView } from "./StatusView";
import { GenerationPreview } from "./GenerationPreview";
import { WorkspaceIcon } from "./WorkspaceIcon";
import { toReactFlowEdges, toReactFlowNodes } from "../lib/reactFlowMapping";
import type { PlanningStatus } from "../store/planningStore";
import { filterGraphNodes, type NodeFocusRequest, type NodeTypeFilter } from "../lib/graphNavigation";
import { NodeSearch } from "./NodeSearch";
import { writeWorkspacePosition, type WorkspaceRestore, type WorkspacePosition } from "../lib/workspacePosition";

interface PlanningCanvasProps {
  positionProjectId?: string | null;
  workspaceRestore?: WorkspaceRestore | null;
  resultRevision: number;
  focusRequest: NodeFocusRequest | null;
  relatedNodeIds?: string[];
  onNavigateNode: (nodeId: string) => void;
  hidden?: boolean;
  toolbar?: ReactNode;
  feedback?: ReactNode;
  errorMessage?: string | null;
  onStart?: () => void;
  hasSelectedProject?: boolean;
  disabled?: boolean;
  isGenerating?: boolean;
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
function FitNewResult({ revision, hidden, nodes, focusRequest, savedViewport, onReady }: {
  revision: number; hidden: boolean; nodes: Node[]; focusRequest: NodeFocusRequest | null;
  savedViewport: WorkspacePosition["viewport"]; onReady: () => void;
}) {
  const currentNodes = useNodes();
  const initialized = useNodesInitialized();
  const { fitView, setCenter, viewportInitialized } = useReactFlow();
  const fittedRevision = useRef<number | null>(null);
  useEffect(() => {
    // The external result can render before React Flow has adopted its positions.
    if (currentNodes !== nodes || !initialized || !viewportInitialized || hidden || fittedRevision.current === revision) return;
    // Explicit navigation takes precedence when a result is first revealed.
    if (focusRequest && nodes.some((node) => node.id === focusRequest.nodeId && !node.hidden)) {
      fittedRevision.current = revision;
      onReady();
      return;
    }
    const frame = requestAnimationFrame(() => {
      fittedRevision.current = revision;
      const move = savedViewport
        ? setCenter(savedViewport.x, savedViewport.y, { zoom: savedViewport.zoom })
        : fitView({ padding: 0.14, maxZoom: 1.4 });
      void move.then(onReady);
    });
    return () => cancelAnimationFrame(frame);
  }, [currentNodes, nodes, initialized, viewportInitialized, hidden, revision, fitView, setCenter, focusRequest, savedViewport, onReady]);
  return null;
}

function FocusRequestedNode({ request, hidden, nodes, shellRef }: {
  request: NodeFocusRequest | null; hidden: boolean; nodes: Node[]; shellRef: { current: HTMLElement | null };
}) {
  const currentNodes = useNodes();
  const initialized = useNodesInitialized();
  const { getInternalNode, getViewport, setCenter, viewportInitialized } = useReactFlow();
  const handled = useRef<NodeFocusRequest | null>(null);
  useEffect(() => {
    if (!request || request === handled.current || hidden || !initialized || !viewportInitialized || currentNodes !== nodes) return;
    const node = getInternalNode(request.nodeId);
    if (!node || node.hidden || !node.measured.width || !node.measured.height) return;
    const frame = requestAnimationFrame(() => {
      handled.current = request;
      void setCenter(node.internals.positionAbsolute.x + node.measured.width! / 2,
        node.internals.positionAbsolute.y + node.measured.height! / 2,
        { zoom: Math.max(0.85, getViewport().zoom) });
      shellRef.current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(request.nodeId)}"]`)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [request, hidden, initialized, viewportInitialized, currentNodes, nodes, getInternalNode, getViewport, setCenter, shellRef]);
  return null;
}

export function PlanningCanvas({
  positionProjectId,
  workspaceRestore,
  resultRevision,
  focusRequest,
  relatedNodeIds,
  onNavigateNode,
  hidden = false,
  toolbar,
  feedback,
  errorMessage,
  onStart,
  hasSelectedProject,
  disabled = false,
  isGenerating = false,
  onConnect,
  onUpdateEdge,
  onRemoveEdge,
  onSelectNode,
  onMoveNode,
  result,
  selectedNodeId,
  status,
}: PlanningCanvasProps) {
  const reader = useContentReader();
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const shellRef = useRef<HTMLElement>(null);
  const readyRevision = useRef<number | null>(null);
  const activeRevision = useRef(resultRevision);
  activeRevision.current = resultRevision;
  const savedViewport = workspaceRestore?.revision === resultRevision ? workspaceRestore.position.viewport : null;
  const rememberViewport = useCallback(() => {
    if (!flow || !positionProjectId || disabled || hidden || readyRevision.current !== resultRevision || activeRevision.current !== resultRevision) return;
    const element = shellRef.current?.querySelector<HTMLElement>(".react-flow");
    if (!element?.clientWidth || !element.clientHeight) return;
    const { x, y, zoom } = flow.getViewport();
    writeWorkspacePosition(positionProjectId, { viewport: {
      x: (element.clientWidth / 2 - x) / zoom, y: (element.clientHeight / 2 - y) / zoom, zoom,
    } });
  }, [flow, positionProjectId, disabled, hidden, resultRevision]);
  const viewportReady = useCallback(() => {
    if (activeRevision.current !== resultRevision) return;
    readyRevision.current = resultRevision;
    rememberViewport();
  }, [resultRevision, rememberViewport]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [filter, setFilter] = useState({ revision: resultRevision, query: "", type: "all" as NodeTypeFilter });
  const query = filter.revision === resultRevision ? filter.query : "";
  const type = filter.revision === resultRevision ? filter.type : "all";
  const filtering = query.trim() !== "" || type !== "all";
  const matches = useMemo(() => filterGraphNodes(result?.nodes ?? [], query, type), [result, query, type]);
  const visibleIds = useMemo(() => new Set(matches.map((node) => node.id)), [matches]);
  const activeFocus = !disabled && focusRequest?.revision === resultRevision ? focusRequest : null;
  const revealedRequest = useRef<NodeFocusRequest | null>(null);
  function changeFilter(nextQuery: string, nextType: NodeTypeFilter) {
    setFilter({ revision: resultRevision, query: nextQuery, type: nextType });
    setSelectedEdgeId(null);
  }
  useEffect(() => {
    if (!activeFocus || revealedRequest.current === activeFocus || !result?.nodes.some((node) => node.id === activeFocus.nodeId)) return;
    revealedRequest.current = activeFocus;
    setSelectedEdgeId(null);
    if (!visibleIds.has(activeFocus.nodeId)) setFilter({ revision: resultRevision, query: "", type: "all" });
  }, [activeFocus, result, visibleIds, resultRevision]);
  const reconnectingEdgeId = useRef<string | null>(null);
  const nodes = useMemo(() => (result ? toReactFlowNodes(result) : []), [result]);
  const edges = useMemo(() => (result ? toReactFlowEdges(result) : []), [result]);
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node>(nodes);
  useEffect(() => {
    // Keep React Flow's measured dimensions and live drag state out of saved data.
    setFlowNodes((previous) => {
      const measured = new Map(previous.map((node) => [node.id, node.measured]));
      return nodes.map((node) => ({ ...node, measured: measured.get(node.id), selected: node.id === selectedNodeId,
        domAttributes: { "aria-keyshortcuts": "Alt+Enter" },
        hidden: !visibleIds.has(node.id), className: relatedNodeIds?.includes(node.id) ? "planning-node--related" : undefined,
        ariaLabel: `${node.data.label}${relatedNodeIds?.includes(node.id) ? ", 선택한 단계의 관련 노드" : ""}` }));
    });
  }, [nodes, selectedNodeId, setFlowNodes, visibleIds, relatedNodeIds]);
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

  const handleNodeClick: NodeMouseHandler = (event, node) => {
    const select = () => { setSelectedEdgeId(null); onSelectNode(node.id); };
    if (reader) reader.select(event, select); else select();
  };
  const handleNodeDoubleClick: NodeMouseHandler = (event, node) => {
    if (event.target instanceof Element && event.target.closest(".react-flow__handle, button")) return;
    event.preventDefault();
    event.stopPropagation();
    readNode(node.id, event.currentTarget as HTMLElement);
  };
  function readNode(id: string, anchor: HTMLElement) {
    // React Flow may select on pointer down; reading keeps the workspace selection intact.
    setFlowNodes((previous) => previous.map((item) => ({ ...item, selected: item.id === selectedNodeId })));
    reader?.open("node", id, anchor);
  }
  const touchReading = useCardDoubleTap(".react-flow__node", (node) => {
    if (node.dataset.id) readNode(node.dataset.id, node);
  });
  function selectEdge(edgeId: string) {
    setSelectedEdgeId(edgeId);
    onSelectNode(null);
  }
  const editableEdges = edges.map((edge) => ({
    ...edge,
    hidden: !visibleIds.has(edge.source) || !visibleIds.has(edge.target),
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
      <section className="canvas-shell" id="planning-canvas" hidden={hidden} ref={shellRef} aria-busy={isGenerating}>
        {isGenerating ? <div className="canvas-heading"><h2>구조 캔버스</h2></div> : null}
        {feedback ?? (!isGenerating ? <StatusView status={status} errorMessage={errorMessage} onStart={onStart} hasSelectedProject={hasSelectedProject} /> : null)}
        {isGenerating ? <div className="canvas-content"><GenerationPreview kind="graph" /></div> : null}
      </section>
    );
  }

  return (
    <section className="canvas-shell" id="planning-canvas" hidden={hidden} ref={shellRef} aria-label="계획 의존성 그래프"
      aria-busy={isGenerating} data-generating={isGenerating}
      {...touchReading}
      onKeyDownCapture={(event) => {
        if (!event.altKey || event.key !== "Enter" || !(event.target instanceof Element)) return;
        const node = event.target.closest<HTMLElement>(".react-flow__node");
        if (!node?.dataset.id) return;
        event.preventDefault();
        event.stopPropagation();
        reader?.open("node", node.dataset.id, node);
      }}>
      <div className="canvas-heading">
        <div><h2>구조 캔버스</h2></div>
        <div className="canvas-heading__tools">
          <span className="canvas-heading__count">{result.nodes.length}개 노드<span aria-hidden="true"> · </span>{result.edges.length}개 연결</span>
          <NodeSearch key={resultRevision} query={query} type={type} matches={matches} total={result.nodes.length}
            disabled={disabled} onChange={changeFilter} onNavigate={onNavigateNode} />
          <button className="canvas-heading__map-toggle" type="button" aria-label={showMiniMap ? "미니맵 숨기기" : "미니맵 표시"} aria-pressed={showMiniMap}
            title={showMiniMap ? "미니맵 숨기기" : "미니맵 표시"} onClick={() => setShowMiniMap((value) => !value)}><WorkspaceIcon name="map" /></button>
        </div>
      </div>
      {toolbar}
      {filtering ? <div className="graph-filter-status" role="status" aria-label="노드 필터 상태">
        <span>{matches.length ? `${matches.length} / ${result.nodes.length}개 노드 표시` : "일치하는 노드 없음"}</span>
        {selectedNodeId && !visibleIds.has(selectedNodeId) ? <button type="button" disabled={disabled}
          onClick={() => onNavigateNode(selectedNodeId)}>선택한 노드 표시</button> : null}
        <button type="button" disabled={disabled} onClick={() => changeFilter("", "all")}>필터 초기화</button>
      </div> : null}
      {feedback}
      <div className="canvas-content">
      <ReactFlow
        onInit={setFlow}
        onMoveEnd={rememberViewport}
        nodesDraggable={!disabled}
        autoPanOnNodeFocus={false}
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
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeDragStart={() => reader?.cancelSelection()}
        onEdgeClick={(_event, edge) => selectEdge(edge.id)}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={() => { onSelectNode(null); setSelectedEdgeId(null); }}
        minZoom={0.25}
        maxZoom={1.4}
      >
        <FitNewResult revision={resultRevision} hidden={hidden} nodes={flowNodes} focusRequest={activeFocus}
          savedViewport={savedViewport} onReady={viewportReady} />
        <FocusRequestedNode request={activeFocus} hidden={hidden} nodes={flowNodes} shellRef={shellRef} />
        <Background gap={24} size={1} color="#cfd8d2" />
        <Controls position="bottom-left" showFitView={false}>
          <ControlButton aria-label="전체 보기" title={filtering ? "표시된 노드 전체 보기" : "전체 보기"} disabled={matches.length === 0} onClick={() => { void flow?.fitView({ padding: 0.14, maxZoom: 1.4 }); }}>
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
      {isGenerating ? <GenerationPreview kind="graph" /> : null}
      </div>
    </section>
  );
}
