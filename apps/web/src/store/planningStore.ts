import { create } from "zustand";
import type { ComponentNode, PlanningResult } from "@ai-planning-platform/shared";
import { loadMockPlanningResult } from "../lib/mockPlanningClient";

export type PlanningStatus = "idle" | "ready" | "loading" | "error" | "empty";

interface PlanningState {
  errorMessage: string | null;
  planningResult: PlanningResult | null;
  requirementText: string;
  selectedNodeId: string | null;
  status: PlanningStatus;
  loadMockResult: () => Promise<void>;
  resetToEmpty: () => void;
  selectNode: (nodeId: string | null) => void;
  setErrorState: (message: string) => void;
  setRequirementText: (value: string) => void;
}

export const usePlanningStore = create<PlanningState>((set, get) => ({
  errorMessage: null,
  planningResult: null,
  requirementText: "",
  selectedNodeId: null,
  status: "idle",
  async loadMockResult() {
    set({ errorMessage: null, status: "loading" });

    try {
      const result = await loadMockPlanningResult();
      const currentRequirement = get().requirementText.trim();

      set({
        planningResult: result,
        requirementText: currentRequirement || result.requirement?.content || "",
        selectedNodeId: result.nodes[0]?.id ?? null,
        status: result.nodes.length > 0 ? "ready" : "empty",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load planning result.";

      set({
        errorMessage: message,
        planningResult: null,
        selectedNodeId: null,
        status: "error",
      });
    }
  },
  resetToEmpty() {
    set({
      errorMessage: null,
      planningResult: null,
      selectedNodeId: null,
      status: "empty",
    });
  },
  selectNode(nodeId) {
    set({ selectedNodeId: nodeId });
  },
  setErrorState(message) {
    set({
      errorMessage: message,
      planningResult: null,
      selectedNodeId: null,
      status: "error",
    });
  },
  setRequirementText(value) {
    set({ requirementText: value });
  },
}));

export function getSelectedNode(
  result: PlanningResult | null,
  selectedNodeId: string | null,
): ComponentNode | null {
  if (!result || !selectedNodeId) {
    return null;
  }

  return result.nodes.find((node) => node.id === selectedNodeId) ?? null;
}
