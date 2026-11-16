"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import type { ComponentNode, RoadmapStep } from "@ai-planning-platform/shared";
import { priorityLabels } from "../lib/planningLabels";
import type { PlanningStatus } from "../store/planningStore";
import { WorkspaceIcon } from "./WorkspaceIcon";
import { ResultSaveButton } from "./ResultSaveButton";
import { useCardDoubleTap, useContentReader } from "./ContentReader";
import { writeWorkspacePosition, type WorkspaceRestore } from "../lib/workspacePosition";

interface RoadmapPanelProps {
  positionProjectId?: string | null;
  resultRevision?: number;
  workspaceRestore?: WorkspaceRestore | null;
  nodes?: ComponentNode[];
  selectedNodeId?: string | null;
  onNavigateNode?: (nodeId: string) => void;
  hidden?: boolean;
  feedback?: ReactNode;
  disabled?: boolean;
  loadingLabel?: string;
  saveBlocked?: boolean;
  editErrorMessage: string | null;
  editStatus: "idle" | "dirty" | "saving" | "error";
  errorMessage: string | null;
  selectedStepId: string | null;
  onSelect: (stepId: string | null) => void;
  onAdd: () => void;
  onSave: () => Promise<void>;
  roadmap: RoadmapStep[];
  status: PlanningStatus;
}

export function RoadmapPanel({ hidden = false, feedback, disabled = false, loadingLabel = "불러오는 중", saveBlocked = false,
  positionProjectId, resultRevision = 0, workspaceRestore,
  nodes = [], selectedNodeId, onNavigateNode,
  editErrorMessage, editStatus, errorMessage, selectedStepId, onSelect, onAdd, onSave, roadmap, status,
}: RoadmapPanelProps) {
  const reader = useContentReader();
  const touchReading = useCardDoubleTap(".roadmap-step", (card) => {
    const anchor = card.querySelector<HTMLButtonElement>(".roadmap-step__select");
    if (anchor && !anchor.disabled && card.dataset.stepId) reader?.open("step", card.dataset.stepId, anchor);
  });
  const stepsRef = useRef<HTMLOListElement>(null);
  const restoredRevision = useRef<number | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; scrollLeft: number; dragging: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const sortedRoadmap = [...roadmap].sort((left, right) => left.order - right.order);
  const selectedOrder = roadmap.find((step) => step.id === selectedStepId)?.order;
  const orderById = new Map(roadmap.map((step) => [step.id, step.order]));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) : null;
  const relatedCount = selectedNode ? roadmap.filter((step) => step.componentNodeIds?.includes(selectedNode.id)).length : 0;
  const canSave = status === "ready" && !disabled && !saveBlocked
    && (editStatus === "dirty" || editStatus === "error")
    && roadmap.every((step) => step.title.trim() && step.description.trim());

  function endDrag(event: PointerEvent<HTMLOListElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    delete event.currentTarget.dataset.dragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  useEffect(() => {
    const list = stepsRef.current;
    const row = list && [...list.children].find((item) => selectedStepId
      ? (item as HTMLElement).dataset.stepId === selectedStepId
      : selectedNodeId && (item as HTMLElement).dataset.related === "true") as HTMLElement | undefined;
    if (!list || hidden || status !== "ready") return;
    // Keep the selected card visible without scrolling the page or editor.
    const reveal = () => {
      if (!row) return;
      if (row.offsetLeft < list.scrollLeft) list.scrollLeft = row.offsetLeft;
      else if (row.offsetLeft + row.offsetWidth > list.scrollLeft + list.clientWidth) {
        list.scrollLeft = row.offsetLeft + row.offsetWidth - list.clientWidth;
      }
    };
    if (restoredRevision.current !== resultRevision) {
      restoredRevision.current = resultRevision;
      if (workspaceRestore?.revision === resultRevision) list.scrollLeft = workspaceRestore.position.roadmapScrollLeft;
      else { list.scrollLeft = 0; reveal(); }
    } else reveal();
    if (typeof ResizeObserver === "undefined") return;
    let width = list.clientWidth;
    const observer = new ResizeObserver(() => {
      if (list.clientWidth !== width) { width = list.clientWidth; reveal(); }
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [selectedStepId, selectedOrder, selectedNodeId, hidden, status, resultRevision, workspaceRestore]);

  return <section className="roadmap" id="planning-roadmap" hidden={hidden} aria-label="계획 로드맵">
    <div className="roadmap__header">
      <h2 className="roadmap__title">로드맵</h2>
      <div className="roadmap__actions">
        <span className="pill">{roadmap.length}단계</span>
        <button className="button roadmap__save" type="button" aria-label="단계 추가" title="단계 추가"
          disabled={disabled || status !== "ready" || editStatus === "saving"} onClick={onAdd}>
          <WorkspaceIcon name="plus" />단계
        </button>
        <ResultSaveButton className="roadmap__save" disabled={!canSave} saving={editStatus === "saving"} onSave={onSave} />
      </div>
    </div>
    {selectedNode ? <p className="roadmap__related-status" role="status" aria-label="관련 로드맵 단계">
      {selectedNode.label} · 관련 {relatedCount}단계
    </p> : null}
    {feedback}
    {editErrorMessage ? <p className="form-field__error" role="alert">{editErrorMessage}</p> : null}
    {status !== "ready" ? <div className="status-view"><div className="status-view__box">
      <h3 className="status-view__title">{status === "loading" ? loadingLabel : "로드맵 없음"}</h3>
      {status === "error" ? <p className="status-view__copy">{errorMessage ?? "계획 결과를 불러올 수 없습니다."}</p> : null}
      {status === "empty" ? <p className="status-view__copy">계획을 생성하세요.</p> : null}
    </div></div> : <>
      {roadmap.length === 0 ? <p className="roadmap__empty">단계가 없습니다. 단계 추가로 로드맵을 만들어 보세요.</p> : null}
      <ol className="roadmap__steps" ref={stepsRef} aria-label="로드맵 단계"
        {...touchReading}
        onScroll={(event) => {
          if (positionProjectId && !disabled && !hidden && restoredRevision.current === resultRevision) {
            writeWorkspacePosition(positionProjectId, { roadmapScrollLeft: event.currentTarget.scrollLeft });
          }
        }}
        data-emphasis={relatedCount > 0 || selectedOrder !== undefined ? "true" : undefined}
        onPointerDown={(event) => {
          suppressClickRef.current = false;
          // Touch keeps the browser's native scrolling and momentum.
          if (event.pointerType === "touch" || !event.isPrimary || event.button !== 0
            || event.currentTarget.scrollWidth <= event.currentTarget.clientWidth) return;
          dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
            scrollLeft: event.currentTarget.scrollLeft, dragging: false };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          if (event.buttons === 0) { endDrag(event); return; }
          const dx = event.clientX - drag.x;
          const dy = event.clientY - drag.y;
          if (!drag.dragging) {
            if (Math.abs(dy) > Math.max(6, Math.abs(dx))) { dragRef.current = null; return; }
            if (Math.abs(dx) < 6) return;
            drag.dragging = true;
            reader?.cancelSelection();
            suppressClickRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            event.currentTarget.dataset.dragging = "true";
          }
          event.preventDefault();
          event.currentTarget.scrollLeft = drag.scrollLeft - dx;
        }}
        onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
        onPointerLeave={() => { if (!dragRef.current?.dragging) dragRef.current = null; }}
        onClickCapture={(event) => {
          if (!suppressClickRef.current || event.detail === 0) return;
          suppressClickRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}>
        {sortedRoadmap.map((step) => <li className="roadmap-step" key={step.id} data-step-id={step.id}
          title="더블클릭 또는 Alt+Enter로 전체 읽기"
          onDoubleClick={(event) => {
            if (disabled || editStatus === "saving" || (event.target instanceof Element
              && event.target.closest("button:not(.roadmap-step__select), a, input, select, textarea"))) return;
            event.preventDefault();
            event.stopPropagation();
            const anchor = event.currentTarget.querySelector<HTMLButtonElement>(".roadmap-step__select");
            if (anchor) reader?.open("step", step.id, anchor);
          }}
          data-emphasized={step.id === selectedStepId || (selectedNode && step.componentNodeIds?.includes(selectedNode.id)) ? "true" : undefined}
          data-related={selectedNode && step.componentNodeIds?.includes(selectedNode.id) ? "true" : undefined}>
          <button className="roadmap-step__select" type="button"
            aria-keyshortcuts="Alt+Enter"
            onKeyDown={(event) => {
              if (!event.altKey || event.key !== "Enter") return;
              event.preventDefault();
              event.stopPropagation();
              reader?.open("step", step.id, event.currentTarget);
            }}
            aria-label={`${step.order}단계 ${step.title.trim() || "제목 없음"} 편집`}
            aria-pressed={step.id === selectedStepId} aria-controls={step.id === selectedStepId ? "workspace-detail" : undefined}
            disabled={disabled || editStatus === "saving"}
            onClick={(event) => {
              const select = () => onSelect(step.id === selectedStepId ? null : step.id);
              if (reader) reader.select(event, select); else select();
            }}>
            <span className="roadmap-step__order" aria-hidden="true">{step.order}</span>
            <span className="roadmap-step__content">
              <span className="roadmap-step__title">{step.title.trim() || "제목 없음"}
                {selectedNode && step.componentNodeIds?.includes(selectedNode.id) ? <span className="roadmap-step__related-label">관련</span> : null}
              </span>
              <span className="roadmap-step__description">{step.description}</span>
              {step.dependsOn.length ? <span className="roadmap-step__dependencies">
                선행 {step.dependsOn.map((id) => orderById.get(id)).join(" · ")}
              </span> : null}
            </span>
            <span className={`pill pill--${step.priority}`} title={`우선순위 ${priorityLabels[step.priority]}`}>{priorityLabels[step.priority]}</span>
          </button>
          {onNavigateNode && step.componentNodeIds?.some((id) => nodeById.has(id)) ? <div className="roadmap-step__nodes" aria-label={`${step.order}단계 관련 노드 탐색`}>
            {step.componentNodeIds.map((id) => {
              const node = nodeById.get(id);
              return node ? <button type="button" key={id} title={node.label} disabled={disabled || editStatus === "saving"}
                aria-label={`${step.order}단계 관련 노드 ${node.label} 위치로 이동`} onClick={() => onNavigateNode(id)}>
                <WorkspaceIcon name="graph" /><span>{node.label || "이름 없음"}</span>
              </button> : null;
            })}
          </div> : null}
        </li>)}
      </ol>
    </>}
  </section>;
}
