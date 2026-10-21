"use client";

import { useEffect, useState } from "react";

export type WorkspaceView = "both" | "graph" | "roadmap";
export const workspaceLayoutKey = "plannote.workspace-layout.v1";
export const defaultWorkspaceLayout = {
  view: "both" as WorkspaceView, inputCollapsed: false, inputWidth: 304, detailWidth: 300, graphShare: 56,
};
type WorkspaceLayout = typeof defaultWorkspaceLayout;
export const layoutLimits = { inputWidth: [260, 420], detailWidth: [280, 420], graphShare: [25, 75] } as const;

export function readWorkspaceLayout(raw: string | null): WorkspaceLayout {
  try {
    const saved = JSON.parse(raw ?? "null");
    if (!saved || typeof saved !== "object") return { ...defaultWorkspaceLayout };
    const layout = { ...defaultWorkspaceLayout };
    if (["both", "graph", "roadmap"].includes(saved.view)) layout.view = saved.view;
    if (typeof saved.inputCollapsed === "boolean") layout.inputCollapsed = saved.inputCollapsed;
    for (const key of ["inputWidth", "detailWidth", "graphShare"] as const) {
      if (typeof saved[key] === "number" && Number.isFinite(saved[key])) {
        layout[key] = Math.min(layoutLimits[key][1], Math.max(layoutLimits[key][0], saved[key]));
      }
    }
    return layout;
  } catch { return { ...defaultWorkspaceLayout }; }
}

export function useWorkspaceLayout() {
  const [layout, setLayout] = useState(defaultWorkspaceLayout);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { setLayout(readWorkspaceLayout(window.localStorage.getItem(workspaceLayoutKey))); } catch { /* Layout remains usable without storage. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      try { window.localStorage.setItem(workspaceLayoutKey, JSON.stringify(layout)); } catch { /* Storage is optional. */ }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [layout, ready]);
  return { layout, setLayout, resetLayout: () => setLayout({ ...defaultWorkspaceLayout }) };
}
