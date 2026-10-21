import { create } from "zustand";
import { sortRoadmapByDependencies } from "../lib/roadmapEditing";
import type { PlanningOperation, PlanningOperationTarget } from "../lib/planningOperations";
import type {
  ActionItemNecessity,
  AIModelOption,
  ComponentNode,
  DependencyEdge,
  PlanType,
  PlanningActionItem,
  PlanningRequest,
  PlanningResult,
  PlanningResultHistoryItem,
  Project,
  ProjectPlanningBrief,
  RoadmapStep,
  SuccessCriterion,
} from "@ai-planning-platform/shared";
import {
  createProject,
  generatePlanningResult,
  getLatestPlanningResult,
  getPlanningModels,
  getPlanningResult,
  getPlanningResultBrief,
  getProjectPlanningBrief,
  listPlanningResults,
  listProjects,
  saveProjectPlanningBrief,
  restorePlanningResult,
  saveGraphEdit,
  PlanningVersionConflictError,
} from "../lib/planningClient";

export type PlanningStatus = "idle" | "ready" | "loading" | "error" | "empty";
export type BriefSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

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
  pendingOperation: PlanningOperation | null;
  failedOperation: PlanningOperation | null;
  retryFailedOperation: () => Promise<void>;
  dismissOperationError: () => void;
  briefSaveStatus: BriefSaveStatus;
  briefSaveErrorMessage: string | null;
  briefRevision: number;
  resultPlanningBrief: ProjectPlanningBrief | null;
  expectedLatestResultId: string | null;
  versionConflict: "edit" | "restore" | null;
  conflictLatestResultId: string | null;
  resolveVersionConflict: (keepEdits: boolean) => Promise<void>;
  errorMessage: string | null;
  graphEditErrorMessage: string | null;
  graphEditStatus: "idle" | "dirty" | "saving" | "error";
  historyErrorMessage: string | null;
  historyStatus: "idle" | "loading" | "ready" | "error";
  isViewingHistoricalResult: boolean;
  planningHistory: PlanningResultHistoryItem[];
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
  selectedPlanningResultId: string | null;
  selectedProjectId: string | null;
  selectedNodeId: string | null;
  status: PlanningStatus;
  createAndSelectProject: (title: string) => Promise<void>;
  generateResult: () => Promise<void>;
  loadProjects: () => Promise<void>;
  loadModels: () => Promise<void>;
  loadPlanningHistory: (projectId: string) => Promise<void>;
  resetToEmpty: () => void;
  restoreSelectedPlanningResult: () => Promise<void>;
  saveGraphEdits: () => Promise<void>;
  saveCurrentPlanningBrief: () => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  selectPlanningResult: (resultId: string) => Promise<void>;
  selectNode: (nodeId: string | null) => void;
  addNode: () => void;
  removeNode: (nodeId: string) => void;
  addEdge: (source: string, target: string, dependencyType: DependencyEdge["dependencyType"]) => void;
  removeEdge: (edgeId: string) => void;
  updateEdge: (edgeId: string, changes: Partial<Pick<DependencyEdge, "source" | "target" | "dependencyType">>) => void;
  updateNode: (
    nodeId: string,
    changes: Partial<
      Pick<ComponentNode, "label" | "description" | "category" | "priority" | "type">
    >,
  ) => void;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
  addRoadmapStep: () => void;
  removeRoadmapStep: (stepId: string) => void;
  updateRoadmapStep: (
    stepId: string,
    changes: Partial<
      Pick<RoadmapStep, "title" | "description" | "priority" | "estimatedEffort" | "dependsOn" | "componentNodeIds">
    >,
  ) => void;
  moveRoadmapStep: (stepId: string, direction: -1 | 1) => void;
  setErrorState: (message: string) => void;
  setPlanningBriefField: <K extends keyof PlanningBriefDraft>(
    field: K,
    value: PlanningBriefDraft[K],
  ) => void;
  setRequirementText: (value: string) => void;
  setSelectedModel: (value: string) => void;
}

export const usePlanningStore = create<PlanningState>((set, get) => {
  // Keep writes ordered when the user types while a previous save is in flight.
  let briefSaveQueue = Promise.resolve();
  function beginOperation(target: PlanningOperationTarget): PlanningOperation {
    const operation = { ...target, startedAt: Date.now() };
    set({ pendingOperation: operation, failedOperation: null, errorMessage: null });
    return operation;
  }
  return ({
  pendingOperation: null,
  failedOperation: null,
  async retryFailedOperation() {
    const target = get().failedOperation;
    if (!target || get().pendingOperation || get().graphEditStatus === "saving") return;
    switch (target.kind) {
      case "projects": await get().loadProjects(); break;
      case "project": await get().selectProject(target.projectId); break;
      case "version":
        if (get().selectedProjectId === target.projectId) await get().selectPlanningResult(target.resultId);
        break;
      case "generate":
        if (get().selectedProjectId === target.projectId) await get().generateResult();
        break;
      case "restore": break;
    }
  },
  dismissOperationError() {
    const kind = get().failedOperation?.kind;
    set({ failedOperation: null, errorMessage: null,
      ...(kind === "project" || kind === "projects" ? { projectErrorMessage: null } : {}),
    });
  },
  briefSaveStatus: "idle",
  briefSaveErrorMessage: null,
  briefRevision: 0,
  resultPlanningBrief: null,
  expectedLatestResultId: null,
  versionConflict: null,
  conflictLatestResultId: null,
  async resolveVersionConflict(keepEdits) {
    const state = get();
    if (!state.selectedProjectId || !state.versionConflict) return;
    if (!keepEdits) {
      await get().selectProject(state.selectedProjectId);
      return;
    }
    if (state.versionConflict !== "edit") return;
    set({ versionConflict: null, graphEditStatus: "dirty", expectedLatestResultId: state.conflictLatestResultId });
    await get().saveGraphEdits();
  },
  errorMessage: null,
  graphEditErrorMessage: null,
  graphEditStatus: "idle",
  historyErrorMessage: null,
  historyStatus: "idle",
  isViewingHistoricalResult: false,
  planningHistory: [],
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
  selectedPlanningResultId: null,
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
    const state = get();
    if (state.pendingOperation || state.graphEditStatus === "saving") return;
    const selectedProjectId = state.selectedProjectId;
    if (!selectedProjectId) {
      set({
        errorMessage: "계획을 저장할 프로젝트를 먼저 선택해 주세요.",
        status: "error",
      });
      return;
    }

    const operation = beginOperation({ kind: "generate", projectId: selectedProjectId });
    set({ status: "loading" });

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
      if (get().pendingOperation !== operation) return;

      set({
        planningResult: result,
        pendingOperation: null,
        failedOperation: null,
        versionConflict: null,
        conflictLatestResultId: null,
        isViewingHistoricalResult: false,
        selectedPlanningResultId: result.metadata.resultId ?? null,
        expectedLatestResultId: result.metadata.resultId ?? null,
        resultPlanningBrief: {
          requirement: request.requirement,
          brief: request.brief!,
          selectedModel: request.options?.model ?? null,
        },
        graphEditErrorMessage: null,
        graphEditStatus: "idle",
        projects: get().projects.map((item) =>
          item.id === result.project?.id && result.project
            ? result.project
            : item,
        ),
        requirementText: currentRequirement || result.requirement?.content || "",
        selectedNodeId: null,
        status: result.nodes.length > 0 ? "ready" : "empty",
      });
      await get().loadPlanningHistory(selectedProjectId);
    } catch (error) {
      if (get().pendingOperation !== operation) return;
      const message =
        error instanceof Error ? error.message : "계획 결과를 불러올 수 없습니다.";

      set({
        errorMessage: message,
        pendingOperation: null,
        failedOperation: operation,
        status: state.planningResult ? (state.planningResult.nodes.length ? "ready" : "empty") : "error",
      });
    }
  },
  async loadProjects() {
    if (get().projectStatus === "loading") {
      return;
    }
    const operation = beginOperation({ kind: "projects" });
    set({ projectErrorMessage: null, projectStatus: "loading", status: "loading" });
    try {
      const projects = await listProjects();
      if (get().pendingOperation !== operation) return;
      set({ projects, projectStatus: "ready" });
      const firstProject = projects[0];
      if (firstProject) {
        await get().selectProject(firstProject.id);
      } else {
        set({
          pendingOperation: null,
          planningResult: null,
          requirementText: "",
          selectedProjectId: null,
          status: "empty",
        });
      }
    } catch (error) {
      if (get().pendingOperation !== operation) return;
      set({
        projectErrorMessage:
          error instanceof Error
            ? error.message
            : "프로젝트 목록을 불러오지 못했습니다.",
        projectStatus: "error",
        pendingOperation: null,
        failedOperation: operation,
        errorMessage: error instanceof Error ? error.message : "프로젝트 목록을 불러오지 못했습니다.",
        status: get().planningResult ? "ready" : "error",
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
  async loadPlanningHistory(projectId) {
    const resultAtRequest = get().selectedPlanningResultId;
    set({ historyErrorMessage: null, historyStatus: "loading" });
    try {
      const history = await listPlanningResults(projectId);
      if (get().selectedProjectId !== projectId || get().selectedPlanningResultId !== resultAtRequest) return;
      const actualResultId = get().planningResult?.metadata.resultId ?? history[0]?.id ?? null;
      set({
        historyStatus: "ready",
        planningHistory: history,
        selectedPlanningResultId: actualResultId,
        expectedLatestResultId: actualResultId,
        isViewingHistoricalResult: actualResultId !== history[0]?.id,
      });
    } catch (error) {
      if (get().selectedProjectId !== projectId || get().selectedPlanningResultId !== resultAtRequest) return;
      set({
        historyErrorMessage:
          error instanceof Error
            ? error.message
            : "계획 생성 이력을 불러오지 못했습니다.",
        historyStatus: "error",
      });
    }
  },
  resetToEmpty() {
    set({
      pendingOperation: null,
      failedOperation: null,
      briefSaveStatus: "dirty",
      briefSaveErrorMessage: null,
      briefRevision: get().briefRevision + 1,
      resultPlanningBrief: null,
      expectedLatestResultId: null,
      versionConflict: null,
      conflictLatestResultId: null,
      errorMessage: null,
      graphEditErrorMessage: null,
      graphEditStatus: "idle",
      isViewingHistoricalResult: false,
      planningBrief: initialPlanningBrief,
      planningHistory: [],
      planningResult: null,
      requirementText: "",
      selectedNodeId: null,
      selectedPlanningResultId: null,
      status: "empty",
    });
  },
  async restoreSelectedPlanningResult() {
    const state = get();
    if (!state.selectedProjectId || !state.selectedPlanningResultId || state.pendingOperation || state.graphEditStatus === "saving") {
      return;
    }
    const operation = beginOperation({ kind: "restore", projectId: state.selectedProjectId, resultId: state.selectedPlanningResultId });
    set({
      errorMessage: null,
      historyErrorMessage: null,
      historyStatus: "loading",
      status: "loading",
    });
    try {
      const restored = await restorePlanningResult(
        state.selectedProjectId,
        state.selectedPlanningResultId,
        (state.versionConflict === "restore" ? state.conflictLatestResultId : null)
          ?? state.expectedLatestResultId ?? state.planningHistory[0]?.id ?? state.selectedPlanningResultId,
      );
      if (get().pendingOperation !== operation) return;
      set({
        pendingOperation: null,
        versionConflict: null,
        conflictLatestResultId: null,
        isViewingHistoricalResult: false,
        briefSaveStatus: "saved",
        briefSaveErrorMessage: null,
        briefRevision: get().briefRevision + 1,
        resultPlanningBrief: restored.planningBrief,
        planningBrief: toDraft(restored.planningBrief),
        planningResult: restored.result,
        graphEditErrorMessage: null,
        graphEditStatus: "idle",
        requirementText: restored.planningBrief.requirement,
        selectedModel:
          restored.planningBrief.selectedModel &&
          get().models.some(
            (model) => model.id === restored.planningBrief.selectedModel,
          )
            ? restored.planningBrief.selectedModel
            : get().selectedModel,
        selectedNodeId: null,
        status: restored.result.nodes.length > 0 ? "ready" : "empty",
      });
      await get().loadPlanningHistory(state.selectedProjectId);
    } catch (error) {
      if (get().pendingOperation !== operation) return;
      set({
        pendingOperation: null,
        historyErrorMessage:
          error instanceof Error
            ? error.message
            : "선택한 계획 버전을 복원하지 못했습니다.",
        historyStatus: "ready",
        status: state.planningResult?.nodes.length ? "ready" : "empty",
      });
      if (error instanceof PlanningVersionConflictError) {
        set({ versionConflict: "restore", conflictLatestResultId: error.latestResultId });
        try {
          const history = await listPlanningResults(state.selectedProjectId);
          if (get().selectedProjectId === state.selectedProjectId) set({ planningHistory: history });
        } catch { /* Preserve the selected result if refreshing history fails. */ }
      }
    }
  },
  async saveCurrentPlanningBrief() {
    const state = get();
    if (
      !state.selectedProjectId ||
      state.projectStatus !== "ready" ||
      state.isViewingHistoricalResult
    ) {
      return;
    }
    const isCurrent = () => get().selectedProjectId === state.selectedProjectId
      && get().briefRevision === state.briefRevision
      && !get().isViewingHistoricalResult;
    briefSaveQueue = briefSaveQueue.then(async () => {
      if (!isCurrent()) return;
      set({ briefSaveStatus: "saving", briefSaveErrorMessage: null });
      try {
        await saveProjectPlanningBrief(
          state.selectedProjectId!,
          toPersistedBrief(state.requirementText, state.planningBrief, state.selectedModel),
        );
        if (isCurrent()) set({ briefSaveStatus: "saved" });
      } catch (error) {
        if (isCurrent()) set({
          briefSaveStatus: "error",
          briefSaveErrorMessage: error instanceof Error ? error.message : "계획 입력을 저장하지 못했습니다.",
        });
      }
    });
    await briefSaveQueue;
  },
  async saveGraphEdits() {
    const state = get();
    if (
      state.pendingOperation ||
      !state.selectedProjectId ||
      !state.selectedPlanningResultId ||
      !state.planningResult ||
      state.versionConflict ||
      (state.graphEditStatus !== "dirty" && state.graphEditStatus !== "error")
    ) {
      return;
    }
    set({ graphEditErrorMessage: null, graphEditStatus: "saving" });
    try {
      const result = await saveGraphEdit(
        state.selectedProjectId,
        state.selectedPlanningResultId,
        state.planningResult.nodes,
        state.planningResult.roadmap,
        state.expectedLatestResultId ?? state.planningHistory[0]?.id ?? state.selectedPlanningResultId,
        state.planningResult.edges,
      );
      set({
        versionConflict: null,
        conflictLatestResultId: null,
        graphEditErrorMessage: null,
        graphEditStatus: "idle",
        isViewingHistoricalResult: false,
        planningResult: result,
        status: result.nodes.length > 0 ? "ready" : "empty",
      });
      await get().loadPlanningHistory(state.selectedProjectId);
    } catch (error) {
      set({
        graphEditErrorMessage:
          error instanceof Error
            ? error.message
            : "Graph 편집본을 저장하지 못했습니다.",
        graphEditStatus: "error",
      });
      if (error instanceof PlanningVersionConflictError) {
        set({ versionConflict: "edit", conflictLatestResultId: error.latestResultId });
        try {
          const history = await listPlanningResults(state.selectedProjectId);
          if (get().selectedProjectId === state.selectedProjectId) set({ planningHistory: history });
        } catch { /* Preserve local edits if refreshing history fails. */ }
      }
    }
  },
  async selectProject(projectId) {
    if (!projectId) {
      return;
    }
    const operation = beginOperation({ kind: "project", projectId });
    set({
      briefSaveStatus: "idle",
      briefSaveErrorMessage: null,
      briefRevision: get().briefRevision + 1,
      resultPlanningBrief: null,
      expectedLatestResultId: null,
      versionConflict: null,
      conflictLatestResultId: null,
      errorMessage: null,
      graphEditErrorMessage: null,
      graphEditStatus: "idle",
      historyErrorMessage: null,
      historyStatus: "loading",
      isViewingHistoricalResult: false,
      planningHistory: [],
      planningResult: null,
      projectErrorMessage: null,
      projectStatus: "loading",
      requirementText: "",
      selectedNodeId: null,
      selectedPlanningResultId: null,
      selectedProjectId: projectId,
      status: "loading",
    });
    try {
      const [loadedResult, persistedBrief, history] = await Promise.all([
        getLatestPlanningResult(projectId),
        getProjectPlanningBrief(projectId),
        listPlanningResults(projectId),
      ]);
      // Read that exact immutable version if the head advanced between requests.
      const result = history[0] && (!loadedResult || (loadedResult.metadata.resultId && loadedResult.metadata.resultId !== history[0].id))
        ? await getPlanningResult(projectId, history[0].id)
        : loadedResult;
      const resultId = result?.metadata.resultId ?? history[0]?.id;
      // A missing legacy snapshot must not prevent viewing an existing result.
      const resultBrief = resultId
        ? await getPlanningResultBrief(projectId, resultId).catch(() => null)
        : null;
      if (get().pendingOperation !== operation) return;
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
        pendingOperation: null,
        planningHistory: history,
        planningResult: result,
        resultPlanningBrief: resultBrief,
        briefSaveStatus: persistedBrief ? "saved" : "idle",
        historyStatus: "ready",
        projectStatus: "ready",
        requirementText:
          persistedBrief?.requirement ?? result?.requirement?.content ?? "",
        selectedModel: restorableModel,
        selectedPlanningResultId: result?.metadata.resultId ?? history[0]?.id ?? null,
        expectedLatestResultId: result?.metadata.resultId ?? history[0]?.id ?? null,
        status: result && result.nodes.length > 0 ? "ready" : "empty",
      });
    } catch (error) {
      if (get().pendingOperation !== operation) return;
      set({
        projectErrorMessage:
          error instanceof Error
            ? error.message
            : "프로젝트를 불러오지 못했습니다.",
        pendingOperation: null,
        failedOperation: operation,
        errorMessage: error instanceof Error ? error.message : "프로젝트를 불러오지 못했습니다.",
        historyStatus: "idle",
        projectStatus: "error",
        status: "error",
      });
    }
  },
  async selectPlanningResult(resultId) {
    const projectId = get().selectedProjectId;
    if (!projectId || !resultId) {
      return;
    }
    const state = get();
    const operation = beginOperation({ kind: "version", projectId, resultId });
    set({ status: "loading", briefRevision: get().briefRevision + 1 });
    try {
      const [result, historicalBrief] = await Promise.all([
        getPlanningResult(projectId, resultId),
        getPlanningResultBrief(projectId, resultId),
      ]);
      if (get().pendingOperation !== operation) return;
      const isHistorical = resultId !== get().planningHistory[0]?.id;
      const historicalModel =
        historicalBrief?.selectedModel ?? result.metadata.model;
      set({
        pendingOperation: null,
        versionConflict: null,
        conflictLatestResultId: null,
        isViewingHistoricalResult: isHistorical,
        graphEditErrorMessage: null,
        graphEditStatus: "idle",
        planningBrief: historicalBrief
          ? toDraft(historicalBrief)
          : initialPlanningBrief,
        planningResult: result,
        resultPlanningBrief: historicalBrief,
        briefSaveStatus: "idle",
        requirementText:
          historicalBrief?.requirement ?? result.requirement?.content ?? "",
        selectedModel:
          historicalModel &&
          get().models.some((model) => model.id === historicalModel)
            ? historicalModel
            : get().selectedModel,
        selectedPlanningResultId: resultId,
        selectedNodeId: null,
        expectedLatestResultId: get().planningHistory[0]?.id ?? resultId,
        status: result.nodes.length > 0 ? "ready" : "empty",
      });
    } catch (error) {
      if (get().pendingOperation !== operation) return;
      set({
        errorMessage:
          error instanceof Error
            ? error.message
            : "선택한 계획 결과를 불러오지 못했습니다.",
        pendingOperation: null,
        failedOperation: operation,
        status: state.planningResult ? (state.planningResult.nodes.length ? "ready" : "empty") : "error",
        briefSaveStatus: state.briefSaveStatus === "saving" ? "dirty" : state.briefSaveStatus,
      });
    }
  },
  selectNode(nodeId) {
    set({ selectedNodeId: nodeId });
  },
  addNode() {
    set((state) => {
      const result = state.planningResult;
      if (!result || state.status !== "ready" || state.graphEditStatus === "saving") return state;
      const anchor = result.nodes.find((node) => node.id === state.selectedNodeId)
        ?? result.nodes[result.nodes.length - 1];
      const node: ComponentNode = {
        id: `node-${crypto.randomUUID()}`,
        type: "feature", label: "새 노드", description: "노드 설명을 입력하세요.",
        category: "사용자 추가", priority: "medium",
        position: { x: (anchor?.position.x ?? 0) + 320, y: (anchor?.position.y ?? 0) + 100 },
      };
      return {
        graphEditErrorMessage: null, graphEditStatus: "dirty", selectedNodeId: node.id,
        planningResult: { ...result, nodes: [...result.nodes, node] },
      };
    });
  },
  removeNode(nodeId) {
    set((state) => {
      const result = state.planningResult;
      if (!result || state.status !== "ready" || state.graphEditStatus === "saving"
        || !result.nodes.some((node) => node.id === nodeId)) return state;
      if (result.nodes.length === 1) {
        return { graphEditErrorMessage: "마지막 노드는 삭제할 수 없습니다." };
      }
      return {
        graphEditErrorMessage: null, graphEditStatus: "dirty",
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        planningResult: {
          ...result,
          nodes: result.nodes.filter((node) => node.id !== nodeId),
          edges: result.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
          roadmap: result.roadmap.map((step) => ({
            ...step,
            ...(step.componentNodeIds ? { componentNodeIds: step.componentNodeIds.filter((id) => id !== nodeId) } : {}),
          })),
        },
      };
    });
  },
  addEdge(source, target, dependencyType) {
    set((state) => {
      const result = state.planningResult;
      if (!result || state.status !== "ready" || state.graphEditStatus === "saving") return state;
      if (!result.nodes.some((node) => node.id === source) || !result.nodes.some((node) => node.id === target)) {
        return { graphEditErrorMessage: "연결할 노드를 선택해 주세요." };
      }
      if (source === target) return { graphEditErrorMessage: "자기 자신에게 연결할 수 없습니다." };
      if (result.edges.some((edge) => edge.source === source && edge.target === target)) {
        return { graphEditErrorMessage: "같은 시작·끝 노드의 연결이 이미 있습니다." };
      }
      const edge: DependencyEdge = { id: `edge-${crypto.randomUUID()}`, source, target, dependencyType, label: "" };
      return {
        graphEditErrorMessage: null, graphEditStatus: "dirty",
        planningResult: { ...result, edges: [...result.edges, edge] },
      };
    });
  },
  updateEdge(edgeId, changes) {
    set((state) => {
      const result = state.planningResult;
      const original = result?.edges.find((edge) => edge.id === edgeId);
      if (!result || !original || state.status !== "ready" || state.graphEditStatus === "saving") return state;
      const updated = { ...original, ...changes };
      if (!result.nodes.some((node) => node.id === updated.source) || !result.nodes.some((node) => node.id === updated.target)) {
        return { graphEditErrorMessage: "연결할 노드를 선택해 주세요." };
      }
      if (updated.source === updated.target) return { graphEditErrorMessage: "자기 자신에게 연결할 수 없습니다." };
      if (result.edges.some((edge) => edge.id !== edgeId && edge.source === updated.source && edge.target === updated.target)) {
        return { graphEditErrorMessage: "같은 시작·끝 노드의 연결이 이미 있습니다." };
      }
      if (updated.source === original.source && updated.target === original.target && updated.dependencyType === original.dependencyType) return state;
      return {
        graphEditErrorMessage: null, graphEditStatus: "dirty",
        planningResult: { ...result, edges: result.edges.map((edge) => edge.id === edgeId ? updated : edge) },
      };
    });
  },
  removeEdge(edgeId) {
    set((state) => {
      const result = state.planningResult;
      if (!result || state.status !== "ready" || state.graphEditStatus === "saving"
        || !result.edges.some((edge) => edge.id === edgeId)) return state;
      return {
        graphEditErrorMessage: null, graphEditStatus: "dirty",
        planningResult: { ...result, edges: result.edges.filter((edge) => edge.id !== edgeId) },
      };
    });
  },
  updateNode(nodeId, changes) {
    set((state) => {
      if (!state.planningResult) {
        return state;
      }
      return {
        graphEditErrorMessage: null,
        graphEditStatus: "dirty",
        planningResult: {
          ...state.planningResult,
          nodes: state.planningResult.nodes.map((node) =>
            node.id === nodeId ? { ...node, ...changes } : node,
          ),
        },
      };
    });
  },
  updateNodePosition(nodeId, x, y) {
    set((state) => {
      if (!state.planningResult) {
        return state;
      }
      return {
        graphEditErrorMessage: null,
        graphEditStatus: "dirty",
        planningResult: {
          ...state.planningResult,
          nodes: state.planningResult.nodes.map((node) =>
            node.id === nodeId
              ? { ...node, position: { x, y } }
              : node,
          ),
        },
      };
    });
  },
  addRoadmapStep() {
    set((state) => {
      const result = state.planningResult;
      if (!result || state.status !== "ready" || state.graphEditStatus === "saving") return state;
      const step: RoadmapStep = {
        id: `step-${crypto.randomUUID()}`, title: "새 단계", description: "단계 설명을 입력하세요.",
        priority: "medium", estimatedEffort: "medium", order: result.roadmap.length + 1,
        dependsOn: [], componentNodeIds: [],
      };
      return { graphEditErrorMessage: null, graphEditStatus: "dirty",
        planningResult: { ...result, roadmap: [...result.roadmap, step] } };
    });
  },
  removeRoadmapStep(stepId) {
    set((state) => {
      const result = state.planningResult;
      if (!result || state.status !== "ready" || state.graphEditStatus === "saving"
        || !result.roadmap.some((step) => step.id === stepId)) return state;
      const roadmap = [...result.roadmap].sort((left, right) => left.order - right.order)
        .filter((step) => step.id !== stepId)
        .map((step, index) => ({ ...step, order: index + 1, dependsOn: step.dependsOn.filter((id) => id !== stepId) }));
      return { graphEditErrorMessage: null, graphEditStatus: "dirty", planningResult: { ...result, roadmap } };
    });
  },
  updateRoadmapStep(stepId, changes) {
    set((state) => {
      const result = state.planningResult;
      if (!result || state.status !== "ready" || state.graphEditStatus === "saving"
        || !result.roadmap.some((step) => step.id === stepId)) return state;
      if (changes.componentNodeIds && (new Set(changes.componentNodeIds).size !== changes.componentNodeIds.length
        || changes.componentNodeIds.some((id) => !result.nodes.some((node) => node.id === id)))) {
        return { graphEditErrorMessage: "관련 노드는 중복 없이 현재 Graph의 노드에서 선택해 주세요." };
      }
      const updated = result.roadmap.map((step) => step.id === stepId ? { ...step, ...changes } : step);
      const roadmap = changes.dependsOn ? sortRoadmapByDependencies(updated) : updated;
      if (!roadmap) return { graphEditErrorMessage: "순환 의존성이 생기거나 존재하지 않는 선행 단계는 선택할 수 없습니다." };
      return {
        graphEditErrorMessage: null,
        graphEditStatus: "dirty",
        planningResult: {
          ...result,
          roadmap,
        },
      };
    });
  },
  moveRoadmapStep(stepId, direction) {
    set((state) => {
      if (!state.planningResult || state.graphEditStatus === "saving" || state.status !== "ready") {
        return state;
      }
      const roadmap = [...state.planningResult.roadmap].sort(
        (left, right) => left.order - right.order,
      );
      const index = roadmap.findIndex((step) => step.id === stepId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= roadmap.length) {
        return state;
      }
      [roadmap[index], roadmap[targetIndex]] = [roadmap[targetIndex]!, roadmap[index]!];
      const reordered = roadmap.map((step, stepIndex) => ({
        ...step,
        order: stepIndex + 1,
      }));
      const orderById = new Map(reordered.map((step) => [step.id, step.order]));
      const hasInvalidDependency = reordered.some((step) =>
        step.dependsOn.some(
          (dependencyId) => (orderById.get(dependencyId) ?? Infinity) >= step.order,
        ),
      );
      if (hasInvalidDependency) {
        return {
          graphEditErrorMessage: "선행 단계보다 앞이나 같은 위치로 이동할 수 없습니다.",
        };
      }
      return {
        graphEditErrorMessage: null,
        graphEditStatus: "dirty",
        planningResult: { ...state.planningResult, roadmap: reordered },
      };
    });
  },
  setErrorState(message) {
    set({
      pendingOperation: null,
      failedOperation: null,
      errorMessage: message,
      planningResult: null,
      selectedNodeId: null,
      status: "error",
    });
  },
  setPlanningBriefField(field, value) {
    set((state) => ({
      briefSaveStatus: "dirty",
      briefSaveErrorMessage: null,
      briefRevision: state.briefRevision + 1,
      isViewingHistoricalResult: false,
      planningBrief: { ...state.planningBrief, [field]: value },
    }));
  },
  setRequirementText(value) {
    set({ isViewingHistoricalResult: false, requirementText: value,
      briefSaveStatus: "dirty", briefSaveErrorMessage: null, briefRevision: get().briefRevision + 1 });
  },
  setSelectedModel(value) {
    set({ isViewingHistoricalResult: false, selectedModel: value,
      briefSaveStatus: "dirty", briefSaveErrorMessage: null, briefRevision: get().briefRevision + 1 });
  },
});
});

export function hasUnappliedInput(state: Pick<PlanningState,
  "planningResult" | "resultPlanningBrief" | "requirementText" | "planningBrief" | "selectedModel"
>): boolean {
  const source = state.resultPlanningBrief;
  if (!state.planningResult || !source) return false;
  const normalize = (input: ProjectPlanningBrief) => JSON.stringify({
    requirement: input.requirement.trim(),
    context: trimList(input.brief.context),
    actionItems: input.brief.actionItems.filter((item) => item.title.trim()).map((item) => ({
      necessity: item.necessity, title: item.title.trim(),
    })),
    constraints: input.brief.constraints?.trim() ?? "",
    planType: input.brief.planType,
    successCriterion: input.brief.successCriterion,
    model: input.selectedModel,
  });
  return normalize(toPersistedBrief(state.requirementText, state.planningBrief, state.selectedModel))
    !== normalize({ ...source, selectedModel: source.selectedModel ?? state.planningResult.metadata.model ?? null });
}

export function getSelectedNode(
  result: PlanningResult | null,
  selectedNodeId: string | null,
): ComponentNode | null {
  if (!result || !selectedNodeId) {
    return null;
  }

  return result.nodes.find((node) => node.id === selectedNodeId) ?? null;
}
