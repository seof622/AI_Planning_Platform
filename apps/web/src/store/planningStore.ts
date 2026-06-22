import { create } from "zustand";
import type {
  ComponentNode,
  PlanningRequest,
  PlanningResult,
  QualityPriority,
  ServicePlatform,
} from "@ai-planning-platform/shared";
import { loadMockPlanningResult } from "../lib/mockPlanningClient";

export type PlanningStatus = "idle" | "ready" | "loading" | "error" | "empty";

export interface PlanningBriefDraft {
  constraints: string;
  mustHaveFeatures: string;
  platform: ServicePlatform;
  qualityPriority: QualityPriority;
  targetUsers: string;
}

const initialPlanningBrief: PlanningBriefDraft = {
  constraints: "",
  mustHaveFeatures: "",
  platform: "web",
  qualityPriority: "speed",
  targetUsers: "",
};

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

interface PlanningState {
  errorMessage: string | null;
  planningBrief: PlanningBriefDraft;
  planningResult: PlanningResult | null;
  requirementText: string;
  selectedNodeId: string | null;
  status: PlanningStatus;
  loadMockResult: () => Promise<void>;
  resetToEmpty: () => void;
  selectNode: (nodeId: string | null) => void;
  setErrorState: (message: string) => void;
  setPlanningBriefField: <K extends keyof PlanningBriefDraft>(
    field: K,
    value: PlanningBriefDraft[K],
  ) => void;
  setRequirementText: (value: string) => void;
}

export const usePlanningStore = create<PlanningState>((set, get) => ({
  errorMessage: null,
  planningBrief: initialPlanningBrief,
  planningResult: null,
  requirementText: "",
  selectedNodeId: null,
  status: "idle",
  async loadMockResult() {
    set({ errorMessage: null, status: "loading" });

    try {
      const currentRequirement = get().requirementText.trim();
      const planningBrief = get().planningBrief;
      const request: PlanningRequest = {
        requirement: currentRequirement,
        brief: {
          constraints: planningBrief.constraints.trim() || undefined,
          mustHaveFeatures: splitList(planningBrief.mustHaveFeatures),
          platform: planningBrief.platform,
          qualityPriority: planningBrief.qualityPriority,
          targetUsers: splitList(planningBrief.targetUsers),
        },
      };
      const result = await loadMockPlanningResult(request);

      set({
        planningResult: result,
        requirementText: currentRequirement || result.requirement?.content || "",
        selectedNodeId: result.nodes[0]?.id ?? null,
        status: result.nodes.length > 0 ? "ready" : "empty",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "계획 결과를 불러올 수 없습니다.";

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
      planningBrief: initialPlanningBrief,
      planningResult: null,
      requirementText: "",
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
  setPlanningBriefField(field, value) {
    set((state) => ({
      planningBrief: { ...state.planningBrief, [field]: value },
    }));
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
