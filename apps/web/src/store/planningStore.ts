import { create } from "zustand";
import type {
  ActionItemNecessity,
  ComponentNode,
  PlanType,
  PlanningActionItem,
  PlanningRequest,
  PlanningResult,
  SuccessCriterion,
} from "@ai-planning-platform/shared";
import { loadMockPlanningResult } from "../lib/mockPlanningClient";

export type PlanningStatus = "idle" | "ready" | "loading" | "error" | "empty";

export interface PlanningActionItemDraft {
  necessity: ActionItemNecessity;
  text: string;
}

export interface PlanningBriefDraft {
  actionItems: PlanningActionItemDraft[];
  constraints: string;
  context: string[];
  planType: PlanType;
  successCriterion: SuccessCriterion;
}

const initialPlanningBrief: PlanningBriefDraft = {
  actionItems: [{ necessity: "required", text: "" }],
  constraints: "",
  context: [""],
  planType: "daily",
  successCriterion: "clarity",
};

function trimList(values: string[]): string[] {
  return values
    .map((item) => item.trim())
    .filter(Boolean);
}

function trimActionItems(values: PlanningActionItemDraft[]): PlanningActionItem[] {
  return values
    .map((item) => ({
      necessity: item.necessity,
      title: item.text.trim(),
    }))
    .filter((item) => item.title.length > 0);
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
          actionItems: trimActionItems(planningBrief.actionItems),
          constraints: planningBrief.constraints.trim() || undefined,
          context: trimList(planningBrief.context),
          planType: planningBrief.planType,
          successCriterion: planningBrief.successCriterion,
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
