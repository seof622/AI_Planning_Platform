"use client";

import { useRef, type PointerEvent } from "react";

interface WorkspaceResizeHandleProps {
  label: string;
  orientation: "horizontal" | "vertical";
  value: number;
  min: number;
  max: number;
  step?: number;
  className?: string;
  controls: string;
  onChange: (value: number) => void;
  onReset: () => void;
  fromPointer: (event: PointerEvent<HTMLDivElement>) => number;
}

export function WorkspaceResizeHandle({ label, orientation, value, min, max, step = 10, className = "",
  controls, onChange, onReset, fromPointer,
}: WorkspaceResizeHandleProps) {
  const activePointer = useRef<number | null>(null);
  const update = (next: number) => onChange(Math.round(Math.min(max, Math.max(min, next))));
  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <div role="separator" tabIndex={0} aria-label={label} aria-orientation={orientation}
    aria-valuenow={Math.round(value)} aria-valuemin={min} aria-valuemax={max} aria-controls={controls}
    title={`${label} · 방향키로 조절 · 두 번 클릭해 초기화`}
    className={`workspace-resize workspace-resize--${orientation} ${className}`}
    onDoubleClick={onReset}
    onPointerDown={(event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      activePointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus({ preventScroll: true });
      event.preventDefault();
    }}
    onPointerMove={(event) => { if (activePointer.current === event.pointerId) update(fromPointer(event)); }}
    onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { activePointer.current = null; }}
    onKeyDown={(event) => {
      const previous = orientation === "vertical" ? "ArrowLeft" : "ArrowUp";
      const next = orientation === "vertical" ? "ArrowRight" : "ArrowDown";
      if (event.key === previous || event.key === next) {
        event.preventDefault(); update(value + (event.key === previous ? -step : step) * (event.shiftKey ? 3 : 1));
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault(); update(event.key === "Home" ? min : max);
      }
    }}><span aria-hidden="true" /></div>;
}
