import { create } from "zustand";
import type {
  ActionItemNecessity,
  AIModelOption,
  ComponentNode,
  PlanType,
  PlanningActionItem,
  PlanningRequest,
  PlanningResult,
  Project,
  ProjectPlanningBrief,
  SuccessCriterion,
} from "@ai-planning-platform/shared";
import {
  createProject,
  generatePlanningResult,
  getLatestPlanningResult,
  getPlanningModels,
  getProjectPlanningBrief,
  listProjects,
  saveProjectPlanningBrief,
} from "../lib/planningClient";

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

function toPersistedBrief(
  requirement: string,
  planningBrief: PlanningBriefDraft,
  selectedModel: string,
): ProjectPlanningBrief {
  return {
    requirement,
    brief: {
      actionItems: planningBrief.actionItems.map((item) => ({
        necessity: item.necessity,
        title: item.text,
      })),
      constraints: planningBrief.constraints || undefined,
      context: planningBrief.context,
      planType: planningBrief.planType,
      successCriterion: planningBrief.successCriterion,
    },
    selectedModel: selectedModel || null,
  };
}

function toDraft(
  persisted: ProjectPlanningBrief | null,
): PlanningBriefDraft {
  if (!persisted) {
    return initialPlanningBrief;
  }
  return {
    actionItems:
      persisted.brief.actionItems.length > 0
        ? persisted.brief.actionItems.map((item) => ({
            necessity: item.necessity,
            text: item.title,
          }))
        : [{ necessity: "required", text: "" }],
    constraints: persisted.brief.constraints ?? "",
    context:
      persisted.brief.context.length > 0 ? persisted.brief.context : [""],
    planType: persisted.brief.planType,
    successCriterion: persisted.brief.successCriterion,
  };
}

interface PlanningState {
  errorMessage: string | null;
  planningBrief: PlanningBriefDraft;
  planningResult: PlanningResult | null;
  modelErrorMessage: string | null;
  models: AIModelOption[];
  modelStatus: "idle" | "loading" | "ready" | "error";
  projectErrorMessage: string | null;
  projects: Project[];
  projectStatus: "idle" | "loading" | "ready" | "error";
  requirementText: string;
  selectedModel: string;
  selectedProjectId: string | null;
  selectedNodeId: string | null;
  status: PlanningStatus;
  createAndSelectProject: (title: string) => Promise<void>;
  generateResult: () => Promise<void>;
  loadProjects: () => Promise<void>;
  loadModels: () => Promise<void>;
  resetToEmpty: () => void;
  saveCurrentPlanningBrief: () => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  selectNode: (nodeId: string | null) => void;
  setErrorState: (message: string) => void;
  setPlanningBriefField: <K extends keyof PlanningBriefDraft>(
    field: K,
    value: PlanningBriefDraft[K],
  ) => void;
  setRequirementText: (value: string) => void;
  setSelectedModel: (value: string) => void;
}

export const usePlanningStore = create<PlanningState>((set, get) => ({
  errorMessage: null,
  planningBrief: initialPlanningBrief,
  planningResult: null,
  modelErrorMessage: null,
  models: [],
  modelStatus: "idle",
  projectErrorMessage: null,
  projects: [],
  projectStatus: "idle",
  requirementText: "",
  selectedModel: "",
  selectedProjectId: null,
  selectedNodeId: null,
  status: "idle",
  async createAndSelectProject(title) {
    set({ projectErrorMessage: null, projectStatus: "loading" });
    try {
      const project = await createProject(title);
      set((state) => ({
        projects: [project, ...state.projects],
        projectStatus: "ready",
      }));
      await get().selectProject(project.id);
    } catch (error) {
      set({
        projectErrorMessage:
          error instanceof Error
            ? error.message
            : "프로젝트를 생성하지 못했습니다.",
        projectStatus: "error",
      });
    }
  },
  async generateResult() {
    const selectedProjectId = get().selectedProjectId;
    if (!selectedProjectId) {
      set({
        errorMessage: "계획을 저장할 프로젝트를 먼저 선택해 주세요.",
        status: "error",
      });
      return;
    }

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
        options: {
          model: get().selectedModel,
        },
      };
      const project = get().projects.find(
        (item) => item.id === selectedProjectId,
      );
      if (project) {
        request.project = {
          description: project.description,
          id: project.id,
          title: project.title,
        };
      }
      const result = await generatePlanningResult(selectedProjectId, request);

      set({
        planningResult: result,
        projects: get().projects.map((item) =>
          item.id === result.project?.id && result.project
            ? result.project
            : item,
        ),
        requirementText: currentRequirement || result.requirement?.content || "",
        selectedNodeId: null,
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
  async loadProjects() {
    if (get().projectStatus === "loading") {
      return;
    }
    set({ projectErrorMessage: null, projectStatus: "loading" });
    try {
      const projects = await listProjects();
      set({ projects, projectStatus: "ready" });
      const firstProject = projects[0];
      if (firstProject) {
        await get().selectProject(firstProject.id);
      } else {
        set({
          planningResult: null,
          requirementText: "",
          selectedProjectId: null,
          status: "empty",
        });
      }
    } catch (error) {
      set({
        projectErrorMessage:
          error instanceof Error
            ? error.message
            : "프로젝트 목록을 불러오지 못했습니다.",
        projectStatus: "error",
      });
    }
  },
  async loadModels() {
    if (get().modelStatus === "loading") {
      return;
    }
    set({ modelErrorMessage: null, modelStatus: "loading" });
    try {
      const catalog = await getPlanningModels();
      set({
        models: catalog.models,
        modelStatus: "ready",
        selectedModel: catalog.defaultModel,
      });
    } catch (error) {
      set({
        modelErrorMessage:
          error instanceof Error
            ? error.message
            : "AI 모델 목록을 불러오지 못했습니다.",
        models: [],
        modelStatus: "error",
        selectedModel: "",
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
  async saveCurrentPlanningBrief() {
    const state = get();
    if (!state.selectedProjectId || state.projectStatus !== "ready") {
      return;
    }
    try {
      await saveProjectPlanningBrief(
        state.selectedProjectId,
        toPersistedBrief(
          state.requirementText,
          state.planningBrief,
          state.selectedModel,
        ),
      );
    } catch (error) {
      set({
        projectErrorMessage:
          error instanceof Error
            ? error.message
            : "계획 입력을 저장하지 못했습니다.",
      });
    }
  },
  async selectProject(projectId) {
    if (!projectId) {
      return;
    }
    set({
      errorMessage: null,
      planningResult: null,
      projectErrorMessage: null,
      projectStatus: "loading",
      requirementText: "",
      selectedNodeId: null,
      selectedProjectId: projectId,
      status: "loading",
    });
    try {
      const [result, persistedBrief] = await Promise.all([
        getLatestPlanningResult(projectId),
        getProjectPlanningBrief(projectId),
      ]);
      const resultModel = result?.metadata.model;
      const persistedModel = persistedBrief?.selectedModel;
      const restorableModel =
        persistedModel && get().models.some((model) => model.id === persistedModel)
          ? persistedModel
          : resultModel && get().models.some((model) => model.id === resultModel)
            ? resultModel
            : get().selectedModel;
      set({
        planningBrief: toDraft(persistedBrief),
        planningResult: result,
        projectStatus: "ready",
        requirementText:
          persistedBrief?.requirement ?? result?.requirement?.content ?? "",
        selectedModel: restorableModel,
        status: result && result.nodes.length > 0 ? "ready" : "empty",
      });
    } catch (error) {
      set({
        projectErrorMessage:
          error instanceof Error
            ? error.message
            : "프로젝트를 불러오지 못했습니다.",
        projectStatus: "error",
        status: "empty",
      });
    }
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
  setSelectedModel(value) {
    set({ selectedModel: value });
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
