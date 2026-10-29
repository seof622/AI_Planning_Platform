import type { PlanningResult } from "@ai-planning-platform/shared";

export const lastProjectKey = "plannote.last-project.v1";
export const workspacePositionPrefix = "plannote.workspace-position.v1:";
export interface WorkspacePosition {
  resultId: string | null;
  selectedNodeId: string | null;
  selectedStepId: string | null;
  viewport: { x: number; y: number; zoom: number } | null;
  roadmapScrollLeft: number;
}
export interface WorkspaceRestore { revision: number; position: WorkspacePosition }
const emptyPosition = (): WorkspacePosition => ({
  resultId: null, selectedNodeId: null, selectedStepId: null, viewport: null, roadmapScrollLeft: 0,
});
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function readWorkspacePosition(projectId: string): WorkspacePosition {
  const position = emptyPosition();
  try {
    const saved = JSON.parse(window.localStorage.getItem(workspacePositionPrefix + projectId) ?? "null");
    if (!saved || typeof saved !== "object") return position;
    for (const key of ["resultId", "selectedNodeId", "selectedStepId"] as const) {
      if (typeof saved[key] === "string") position[key] = saved[key];
    }
    // The canvas stores its center in graph coordinates, independent of panel size.
    const view = saved.viewport;
    if (view && finite(view.x) && finite(view.y) && finite(view.zoom) && view.zoom >= 0.25 && view.zoom <= 1.4) {
      position.viewport = { x: view.x, y: view.y, zoom: view.zoom };
    }
    if (finite(saved.roadmapScrollLeft) && saved.roadmapScrollLeft >= 0) position.roadmapScrollLeft = saved.roadmapScrollLeft;
  } catch { /* Private browsing, corrupt data and unavailable storage use defaults. */ }
  return position;
}

export function writeWorkspacePosition(projectId: string, changes: Partial<WorkspacePosition>) {
  try {
    window.localStorage.setItem(workspacePositionPrefix + projectId, JSON.stringify({ ...readWorkspacePosition(projectId), ...changes }));
  } catch { /* Navigation remains usable when storage is unavailable or full. */ }
}

export function readLastProject(): string | null {
  try { return window.localStorage.getItem(lastProjectKey); } catch { return null; }
}

export function writeLastProject(projectId: string) {
  try { window.localStorage.setItem(lastProjectKey, projectId); } catch { /* Storage is optional. */ }
}

export function restoreWorkspacePosition(projectId: string, result: PlanningResult | null, resultId: string | null): WorkspacePosition {
  const saved = readWorkspacePosition(projectId);
  const selectedNodeId = result?.nodes.some((node) => node.id === saved.selectedNodeId) ? saved.selectedNodeId : null;
  const selectedStepId = !selectedNodeId && result?.roadmap.some((step) => step.id === saved.selectedStepId) ? saved.selectedStepId : null;
  return { ...saved, resultId, selectedNodeId, selectedStepId,
    viewport: result && saved.resultId === resultId ? saved.viewport : null,
    roadmapScrollLeft: result && saved.resultId === resultId ? saved.roadmapScrollLeft : 0 };
}
