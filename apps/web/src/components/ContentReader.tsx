"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import type { ComponentNode, RoadmapStep } from "@ai-planning-platform/shared";
import { effortLabels, nodeTypeLabels, priorityLabels } from "../lib/planningLabels";
import { WorkspaceIcon } from "./WorkspaceIcon";

type ContentKind = "node" | "step";
type ReadingTarget = { kind: ContentKind; id: string; anchor: HTMLElement; scope: string };
const ReaderContext = createContext<{
  open: (kind: ContentKind, id: string, anchor: HTMLElement) => void;
  select: (event: MouseEvent<Element>, action: () => void) => void;
  cancelSelection: () => void;
} | null>(null);

export function useContentReader() {
  return useContext(ReaderContext);
}

// Touch browsers do not consistently emit dblclick. Keep taps separate from swipes.
export function useCardDoubleTap(selector: string, onRead: (card: HTMLElement) => void) {
  const start = useRef<{ card: HTMLElement; x: number; y: number } | null>(null);
  const previous = useRef<{ card: HTMLElement; time: number; x: number; y: number } | null>(null);
  const cancel = () => { start.current = null; previous.current = null; };
  return {
    onTouchStartCapture(event: TouchEvent<HTMLElement>) {
      const touch = event.touches[0];
      const target = event.target;
      if (event.touches.length !== 1 || !touch || !(target instanceof Element)
        || target.closest(".react-flow__handle, button:not(.roadmap-step__select), a, input, select, textarea")) { cancel(); return; }
      const card = target.closest<HTMLElement>(selector);
      if (card) start.current = { card, x: touch.clientX, y: touch.clientY };
      else cancel();
    },
    onTouchMoveCapture(event: TouchEvent<HTMLElement>) {
      const touch = event.touches[0];
      if (!touch || (start.current && Math.hypot(touch.clientX - start.current.x, touch.clientY - start.current.y) > 8)) cancel();
    },
    onTouchCancelCapture: cancel,
    onTouchEndCapture(event: TouchEvent<HTMLElement>) {
      const tap = start.current;
      start.current = null;
      if (!tap || event.touches.length) return;
      const last = previous.current;
      const time = performance.now();
      if (last?.card === tap.card && time - last.time <= 300 && Math.hypot(tap.x - last.x, tap.y - last.y) <= 20) {
        previous.current = null;
        event.preventDefault();
        // Let the canvas drag handler receive touchend and finish its gesture.
        onRead(tap.card);
      } else previous.current = { ...tap, time };
    },
  };
}

export function ContentReaderProvider({ children, scope, nodes, roadmap, disabled, onEdit }: {
  children: ReactNode;
  scope: string;
  nodes: ComponentNode[];
  roadmap: RoadmapStep[];
  disabled: boolean;
  onEdit: (kind: ContentKind, id: string) => void;
}) {
  const [target, setTarget] = useState<ReadingTarget | null>(null);
  const pendingSelection = useRef<{ timer: number; anchor: HTMLElement } | null>(null);
  const cancelSelection = useCallback(() => {
    if (pendingSelection.current) window.clearTimeout(pendingSelection.current.timer);
    pendingSelection.current = null;
  }, []);
  const open = useCallback((kind: ContentKind, id: string, anchor: HTMLElement) => {
    cancelSelection();
    if (!disabled) setTarget({ kind, id, anchor, scope });
  }, [cancelSelection, disabled, scope]);
  const select = useCallback((event: MouseEvent<Element>, action: () => void) => {
    cancelSelection();
    if (disabled) return;
    if (event.detail === 0) { action(); return; }
    if (event.detail > 1) return;
    // Opening the editor on the first click would move the card before the second click.
    const anchor = event.currentTarget;
    if (!(anchor instanceof HTMLElement)) return;
    pendingSelection.current = { anchor, timer: window.setTimeout(() => {
      pendingSelection.current = null;
      if (anchor.isConnected) action();
    }, 300) };
  }, [cancelSelection, disabled]);
  useEffect(() => {
    function pointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !pendingSelection.current?.anchor.contains(event.target)) cancelSelection();
    }
    document.addEventListener("pointerdown", pointerDown, true);
    return () => { cancelSelection(); document.removeEventListener("pointerdown", pointerDown, true); };
  }, [cancelSelection, disabled, scope]);
  const context = useMemo(() => ({ open, select, cancelSelection }), [open, select, cancelSelection]);
  const close = useCallback((restoreFocus = true) => {
    if (restoreFocus && target?.anchor.isConnected) target.anchor.focus({ preventScroll: true });
    setTarget(null);
  }, [target]);
  const item = target?.kind === "node" ? nodes.find((node) => node.id === target.id)
    : roadmap.find((step) => step.id === target?.id);
  const active = target && target.scope === scope && !disabled && item;
  useEffect(() => {
    if (target && !active) setTarget(null);
  }, [active, target]);

  return <ReaderContext.Provider value={context}>
    {children}
    {active ? <ContentReader key={`${target.scope}:${target.kind}:${target.id}`} target={target} item={item}
      onClose={close} onEdit={() => { close(false); onEdit(target.kind, target.id); }} /> : null}
  </ReaderContext.Provider>;
}

function ContentReader({ target, item, onClose, onEdit }: {
  target: ReadingTarget; item: ComponentNode | RoadmapStep; onClose: (restoreFocus?: boolean) => void; onEdit: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const [expanded, setExpanded] = useState(true);
  const [compact, setCompact] = useState(() => window.matchMedia("(max-width: 900px)").matches);
  const modal = expanded || compact;
  const node = target.kind === "node" ? item as ComponentNode : null;
  const step = target.kind === "step" ? item as RoadmapStep : null;
  const title = node ? node.label : step!.title;
  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const update = () => setCompact(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (modal) dialog.showModal(); else dialog.show();
    heading.current?.focus({ preventScroll: true });
    let frame = 0;
    const position = () => {
      const source = target.anchor.closest<HTMLElement>(".react-flow__node, .roadmap-step") ?? target.anchor;
      const box = source.getBoundingClientRect();
      const clippingBox = source.closest(".react-flow, .roadmap__steps")?.getBoundingClientRect();
      if (!source.isConnected || !source.getClientRects().length || (clippingBox &&
        (box.right <= clippingBox.left || box.left >= clippingBox.right || box.bottom <= clippingBox.top || box.top >= clippingBox.bottom))) {
        onClose(false);
        return;
      }
      if (!modal) {
        const margin = 12, gap = 12, width = dialog.offsetWidth, height = dialog.offsetHeight;
        const right = window.innerWidth - margin - width, bottom = window.innerHeight - margin - height;
        let x = box.right + gap, y = box.top;
        if (x > right) {
          if (box.left - gap - width >= margin) x = box.left - gap - width;
          else {
            x = box.left;
            y = box.bottom + gap + height <= window.innerHeight - margin ? box.bottom + gap : box.top - gap - height;
          }
        }
        dialog.style.left = `${Math.max(margin, Math.min(x, right))}px`;
        dialog.style.top = `${Math.max(margin, Math.min(y, bottom))}px`;
      }
      frame = requestAnimationFrame(position);
    };
    position();
    return () => { cancelAnimationFrame(frame); dialog.close(); dialog.style.left = ""; dialog.style.top = ""; };
  }, [target, modal, onClose]);
  useEffect(() => {
    function pointerDown(event: PointerEvent) {
      if (modal || !(event.target instanceof Element) || ref.current?.contains(event.target)) return;
      onClose(false);
    }
    function keyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
    document.addEventListener("pointerdown", pointerDown, true);
    document.addEventListener("keydown", keyDown, true);
    return () => {
      document.removeEventListener("pointerdown", pointerDown, true);
      document.removeEventListener("keydown", keyDown, true);
    };
  }, [modal, onClose]);

  return createPortal(<dialog className="content-reader" ref={ref} aria-labelledby={titleId}
    aria-modal={modal ? "true" : undefined} data-expanded={modal} data-source-kind={target.kind}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => {
      if (!modal || event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
    <div className="content-reader__header">
      <span>{node ? "노드" : `${step!.order}단계`} · 전체 읽기</span>
      <div className="content-reader__tools">
        {!compact ? <button className="button" type="button" onClick={() => setExpanded((value) => !value)}>
          <WorkspaceIcon name={expanded ? "collapse" : "expand"} />{expanded ? "작게 보기" : "크게 보기"}
        </button> : null}
        <button className="button button--icon" type="button" aria-label="전체 읽기 닫기" onClick={() => onClose()}>
          <WorkspaceIcon name="close" />
        </button>
      </div>
    </div>
    <div className="content-reader__body">
      <h2 id={titleId} ref={heading} tabIndex={-1}>{title.trim() || "제목 없음"}</h2>
      <div className="content-reader__meta">
        {node ? <span className="pill">{nodeTypeLabels[node.type]} · {node.category}</span> : null}
        <span className={`pill pill--${item.priority}`}>{priorityLabels[item.priority]}</span>
        {step ? <span className="pill">작업량 {effortLabels[step.estimatedEffort]}</span> : null}
      </div>
      <p className="content-reader__description">{item.description}</p>
    </div>
    <div className="content-reader__footer">
      <button className="button" type="button" onClick={onEdit}>편집 <WorkspaceIcon name="edit" /></button>
    </div>
  </dialog>, document.body);
}
