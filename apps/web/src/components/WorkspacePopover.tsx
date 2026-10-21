"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface WorkspacePopoverProps {
  label: string;
  children: ReactNode;
  className?: string;
  openOn?: string | null;
  closeOn?: string | null;
}

export function WorkspacePopover({ label, children, className = "", openOn, closeOn }: WorkspacePopoverProps) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (closeOn && ref.current) ref.current.open = false;
  }, [closeOn]);
  useEffect(() => {
    if (openOn && ref.current) ref.current.open = true;
  }, [openOn]);
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (ref.current?.open && event.target instanceof Node && !ref.current.contains(event.target)) {
        ref.current.open = false;
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !ref.current?.open) return;
      const hadFocus = ref.current.contains(document.activeElement);
      ref.current.open = false;
      if (hadFocus) ref.current.querySelector("summary")?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
  return (
    <details className={`workspace-popover ${className}`} ref={ref}>
      <summary className="button">{label}</summary>
      <div className="workspace-popover__content">
        <div className="workspace-popover__heading"><strong>{label}</strong><button type="button" aria-label={`${label} 닫기`} onClick={() => {
          if (ref.current) { ref.current.open = false; ref.current.querySelector("summary")?.focus(); }
        }}>닫기</button></div>
        {children}
      </div>
    </details>
  );
}
