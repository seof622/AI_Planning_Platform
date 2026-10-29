"use client";

import { useEffect } from "react";
import { usePlanningStore } from "../store/planningStore";
import { writeWorkspacePosition } from "./workspacePosition";

export function useWorkspacePositionPersistence() {
  useEffect(() => usePlanningStore.subscribe((state, previous) => {
    if (!state.selectedProjectId || state.projectStatus !== "ready" || state.pendingOperation || !state.planningResult) return;
    if (state.selectedProjectId === previous.selectedProjectId && state.canvasRevision === previous.canvasRevision
      && state.selectedPlanningResultId === previous.selectedPlanningResultId
      && state.selectedNodeId === previous.selectedNodeId && state.selectedRoadmapStepId === previous.selectedRoadmapStepId) return;
    const restore = state.workspaceRestore?.revision === state.canvasRevision ? state.workspaceRestore.position : null;
    const newResult = state.canvasRevision !== previous.canvasRevision;
    writeWorkspacePosition(state.selectedProjectId, {
      ...(newResult ? { viewport: restore?.viewport ?? null, roadmapScrollLeft: restore?.roadmapScrollLeft ?? 0 } : {}),
      resultId: state.selectedPlanningResultId, selectedNodeId: state.selectedNodeId, selectedStepId: state.selectedRoadmapStepId,
    });
  }), []);
}
