import type {
  PlanningResult,
  Project,
} from "@ai-planning-platform/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasUnappliedInput, usePlanningStore } from "./planningStore";
import { validatePlanningResult, mockPlanningResult } from "@ai-planning-platform/shared";

const project: Project = {
  createdAt: "2026-07-26T00:00:00Z",
  description: "Test project",
  id: "project-test",
  status: "draft",
  title: "Test project",
  updatedAt: "2026-07-26T00:00:00Z",
};

const miniModel = {
  cost: "low" as const,
  description: "빠르고 경제적으로 계획 초안을 생성합니다.",
  id: "gpt-5-mini",
  label: "GPT-5 mini",
  quality: "standard" as const,
  recommendedFor: "빠른 초안",
  speed: "fast" as const,
};

const lunaModel = {
  cost: "medium" as const,
  description: "속도와 결과 품질의 균형을 맞춘 모델입니다.",
  id: "gpt-5.6-luna",
  label: "GPT-5.6 Luna",
  quality: "high" as const,
  recommendedFor: "일반 프로젝트",
  speed: "fast" as const,
};

const planningResult: PlanningResult = {
  edges: [],
  metadata: {
    generatedAt: "2026-07-26T00:00:00Z",
    model: "gpt-5.6-luna",
    workflowVersion: "test",
  },
  nodes: [
    {
      category: "Web",
      description: "Test node",
      id: "node-test",
      label: "Test node",
      position: { x: 0, y: 0 },
      priority: "high",
      type: "ui",
    },
  ],
  project: { ...project, status: "generated" },
  requirement: {
    content: "Build a test plan",
    createdAt: "2026-07-26T00:00:00Z",
    id: "requirement-test",
    priority: "high",
    projectId: project.id,
    source: "user",
    updatedAt: "2026-07-26T00:00:00Z",
  },
  roadmap: [],
  summary: "Test plan",
};

const persistedBrief = {
  brief: {
    actionItems: [{ necessity: "required" as const, title: "Implement tests" }],
    constraints: "Keep it focused",
    context: ["Web application"],
    planType: "project" as const,
    successCriterion: "quality" as const,
  },
  requirement: "Build a test plan",
  selectedModel: "gpt-5.6-luna",
};

const planningHistory = [
  {
    canRestore: true,
    createdAt: "2026-07-26T00:00:00Z",
    id: "planning-result-latest",
    model: "gpt-5.6-luna",
    summary: "Test plan",
    workflowVersion: "test",
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function setLoadedResult() {
  usePlanningStore.setState({
    planningResult, planningHistory, selectedProjectId: project.id,
    selectedPlanningResultId: planningHistory[0]!.id, expectedLatestResultId: planningHistory[0]!.id,
    projects: [project], projectStatus: "ready", status: "ready", selectedModel: lunaModel.id,
    resultPlanningBrief: persistedBrief, requirementText: persistedBrief.requirement,
    planningBrief: { ...persistedBrief.brief, actionItems: [{ necessity: "required", text: "Implement tests" }] },
  });
}

describe("planningStore", () => {
  beforeEach(() => {
    localStorage.clear();
    usePlanningStore.setState(usePlanningStore.getInitialState(), true);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("loads the model catalog and selects the server default", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        defaultModel: "gpt-5-mini",
        models: [
          miniModel,
          lunaModel,
        ],
      }),
    );

    await usePlanningStore.getState().loadModels();

    const state = usePlanningStore.getState();
    expect(state.modelStatus).toBe("ready");
    expect(state.selectedModel).toBe("gpt-5-mini");
    expect(state.models).toHaveLength(2);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/planning/models",
      undefined,
    );
  });

  it("selects the first project and restores its latest result", async () => {
    usePlanningStore.setState({
      models: [lunaModel],
      modelStatus: "ready",
      selectedModel: "gpt-5.6-luna",
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse([project]))
      .mockResolvedValueOnce(jsonResponse(planningResult))
      .mockResolvedValueOnce(jsonResponse(persistedBrief))
      .mockResolvedValueOnce(jsonResponse(planningHistory))
      .mockResolvedValueOnce(jsonResponse(persistedBrief));

    await usePlanningStore.getState().loadProjects();

    const state = usePlanningStore.getState();
    expect(state.selectedProjectId).toBe(project.id);
    expect(state.planningResult?.summary).toBe("Test plan");
    expect(state.requirementText).toBe("Build a test plan");
    expect(state.planningBrief.actionItems[0]?.text).toBe("Implement tests");
    expect(state.planningBrief.constraints).toBe("Keep it focused");
    expect(state.planningHistory).toEqual(planningHistory);
    expect(state.selectedPlanningResultId).toBe("planning-result-latest");
    expect(state.selectedModel).toBe("gpt-5.6-luna");
    expect(state.status).toBe("ready");
    expect(state.briefSaveStatus).toBe("saved");
    expect(hasUnappliedInput(state)).toBe(false);
  });

  it("saves the current planning brief for the selected project", async () => {
    usePlanningStore.setState({
      planningBrief: {
        actionItems: [{ necessity: "required", text: "Implement tests" }],
        constraints: "Keep it focused",
        context: ["Web application"],
        planType: "project",
        successCriterion: "quality",
      },
      projectStatus: "ready",
      requirementText: "Build a test plan",
      selectedModel: "gpt-5.6-luna",
      selectedProjectId: project.id,
    });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(persistedBrief));

    await usePlanningStore.getState().saveCurrentPlanningBrief();

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe(
      "http://localhost:8000/projects/project-test/planning-brief",
    );
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual(persistedBrief);
    expect(usePlanningStore.getState().briefSaveStatus).toBe("saved");
  });

  it("groups continuous field typing and returns to the saved state without changing input or version metadata", () => {
    setLoadedResult();
    const store = usePlanningStore.getState();
    store.selectNode("node-test");
    store.updateNode("node-test", { label: "A" });
    store.updateNode("node-test", { label: "AB" });
    store.finishEditGroup();
    store.updateNode("node-test", { description: "Changed description" });
    expect(usePlanningStore.getState().editPast).toHaveLength(2);
    store.setRequirementText("Keep this input");
    store.undoEdit();
    expect(usePlanningStore.getState().planningResult?.nodes[0]).toMatchObject({ label: "AB", description: "Test node" });
    store.undoEdit();
    expect(usePlanningStore.getState()).toMatchObject({ graphEditStatus: "idle", requirementText: "Keep this input",
      selectedPlanningResultId: "planning-result-latest", selectedNodeId: "node-test" });
    store.redoEdit();
    store.redoEdit();
    expect(usePlanningStore.getState().planningResult?.nodes[0]).toMatchObject({ label: "AB", description: "Changed description" });
    expect(usePlanningStore.getState().graphEditStatus).toBe("dirty");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("undoes node deletion together with its edges and roadmap references", () => {
    const original = structuredClone(mockPlanningResult);
    usePlanningStore.setState({ planningResult: original, status: "ready" });
    const store = usePlanningStore.getState();
    const id = original.nodes[0]!.id;
    store.selectNode(id);
    store.removeNode(id);
    expect(usePlanningStore.getState().planningResult?.edges.some((edge) => edge.source === id || edge.target === id)).toBe(false);
    store.undoEdit();
    expect(usePlanningStore.getState().planningResult).toEqual(original);
    expect(usePlanningStore.getState().selectedNodeId).toBe(id);
    store.redoEdit();
    expect(usePlanningStore.getState().planningResult?.nodes.some((node) => node.id === id)).toBe(false);
    expect(usePlanningStore.getState().selectedNodeId).toBeNull();
    expect(validatePlanningResult(usePlanningStore.getState().planningResult!).valid).toBe(true);
  });

  it("undoes roadmap deletion with dependent references and replays structural edits in order", () => {
    const original = structuredClone(mockPlanningResult);
    usePlanningStore.setState({ planningResult: original, status: "ready" });
    const store = usePlanningStore.getState();
    store.removeRoadmapStep(original.roadmap[0]!.id);
    store.addNode();
    const nodeId = usePlanningStore.getState().selectedNodeId!;
    store.updateNodePosition(nodeId, 120, 240);
    store.addEdge(original.nodes[0]!.id, nodeId, "requires");
    store.addRoadmapStep();
    const final = usePlanningStore.getState().planningResult;
    for (let i = 0; i < 5; i++) store.undoEdit();
    expect(usePlanningStore.getState().planningResult).toEqual(original);
    expect(usePlanningStore.getState().graphEditStatus).toBe("idle");
    for (let i = 0; i < 5; i++) store.redoEdit();
    expect(usePlanningStore.getState().planningResult).toEqual(final);
    expect(validatePlanningResult(final!).valid).toBe(true);
  });

  it("ignores rejected and unchanged edits, clears redo on a new edit and bounds history", () => {
    setLoadedResult();
    const store = usePlanningStore.getState();
    store.updateNode("node-test", { label: "Test node" });
    store.updateNodePosition("node-test", 0, 0);
    store.addEdge("node-test", "node-test", "requires");
    expect(usePlanningStore.getState().editPast).toHaveLength(0);
    store.updateNode("node-test", { label: "Changed" });
    store.undoEdit();
    store.updateNodePosition("node-test", 30, 40);
    expect(usePlanningStore.getState().editFuture).toHaveLength(0);
    for (let i = 0; i < 110; i++) store.updateNodePosition("node-test", i, 0);
    expect(usePlanningStore.getState().editPast).toHaveLength(100);
  });

  it("replays connection changes and roadmap reference and order edits without losing consistency", () => {
    const original = structuredClone(mockPlanningResult);
    usePlanningStore.setState({ planningResult: original, status: "ready" });
    const store = usePlanningStore.getState();
    store.updateEdge(original.edges[0]!.id, { dependencyType: "related" });
    store.removeEdge(original.edges[0]!.id);
    store.updateRoadmapStep(original.roadmap[0]!.id, { componentNodeIds: [] });
    store.updateRoadmapStep(original.roadmap[2]!.id, { dependsOn: [original.roadmap[0]!.id] });
    store.moveRoadmapStep(original.roadmap[1]!.id, 1);
    const final = usePlanningStore.getState().planningResult;
    const count = usePlanningStore.getState().editPast.length;
    expect(count).toBe(5);
    for (let i = 0; i < count; i++) store.undoEdit();
    expect(usePlanningStore.getState().planningResult).toEqual(original);
    for (let i = 0; i < count; i++) store.redoEdit();
    expect(usePlanningStore.getState().planningResult).toEqual(final);
    expect(validatePlanningResult(final!).valid).toBe(true);
  });

  it("keeps the concurrency conflict and token when undoing or redoing a failed save", async () => {
    setLoadedResult();
    const store = usePlanningStore.getState();
    store.updateNode("node-test", { label: "Local edit" });
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ detail: { code: "planning_version_conflict", message: "Conflict", latestResultId: "other-head" } }, 409))
      .mockResolvedValueOnce(jsonResponse([{ ...planningHistory[0]!, id: "other-head" }, ...planningHistory]));
    await store.saveGraphEdits();
    store.undoEdit();
    store.redoEdit();
    expect(usePlanningStore.getState()).toMatchObject({ graphEditStatus: "dirty", versionConflict: "edit",
      conflictLatestResultId: "other-head", expectedLatestResultId: "planning-result-latest" });
    await store.saveGraphEdits();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retains undo across saves and compares dirty state with the newly saved content", async () => {
    setLoadedResult();
    const store = usePlanningStore.getState();
    store.updateNode("node-test", { label: "Saved edit" });
    const result = { ...usePlanningStore.getState().planningResult!, metadata: { ...planningResult.metadata, resultId: "saved-edit" } };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(result))
      .mockResolvedValueOnce(jsonResponse([{ ...planningHistory[0]!, id: "saved-edit" }, ...planningHistory]));
    await store.saveGraphEdits();
    const revision = usePlanningStore.getState().canvasRevision;
    store.undoEdit();
    expect(usePlanningStore.getState()).toMatchObject({ graphEditStatus: "dirty", selectedPlanningResultId: "saved-edit" });
    expect(usePlanningStore.getState().planningResult?.metadata.resultId).toBe("saved-edit");
    store.redoEdit();
    expect(usePlanningStore.getState().graphEditStatus).toBe("idle");
    expect(usePlanningStore.getState().canvasRevision).toBe(revision);
  });

  it("blocks history during saving/loading and preserves history after failed version lookup", async () => {
    setLoadedResult();
    const store = usePlanningStore.getState();
    store.updateNode("node-test", { label: "Local edit" });
    usePlanningStore.setState({ graphEditStatus: "saving" });
    store.undoEdit();
    store.updateNode("node-test", { label: "Forbidden" });
    expect(usePlanningStore.getState().planningResult?.nodes[0]?.label).toBe("Local edit");
    usePlanningStore.setState({ graphEditStatus: "dirty" });
    let complete!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }))
      .mockResolvedValueOnce(jsonResponse(persistedBrief));
    const loading = store.selectPlanningResult("missing-version");
    store.undoEdit();
    expect(usePlanningStore.getState().planningResult?.nodes[0]?.label).toBe("Local edit");
    complete(jsonResponse({ detail: "Lookup failed" }, 503));
    await loading;
    expect(usePlanningStore.getState().editPast).toHaveLength(1);
    store.undoEdit();
    expect(usePlanningStore.getState().planningResult).toEqual(planningResult);
    expect(usePlanningStore.getState().graphEditStatus).toBe("idle");
  });

  it("resets local history only after a successful version change or explicit reset", async () => {
    setLoadedResult();
    const store = usePlanningStore.getState();
    store.updateNode("node-test", { label: "Local edit" });
    const revision = usePlanningStore.getState().canvasRevision;
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(planningResult)).mockResolvedValueOnce(jsonResponse(persistedBrief));
    await store.selectPlanningResult("other-version");
    expect(usePlanningStore.getState()).toMatchObject({ editPast: [], editFuture: [], savedEditSnapshot: null, canvasRevision: revision + 1 });
    store.updateNode("node-test", { label: "Another edit" });
    store.resetToEmpty();
    expect(usePlanningStore.getState()).toMatchObject({ editPast: [], editFuture: [], planningResult: null });
  });

  it("reports autosave failure separately and clears it on retry", async () => {
    usePlanningStore.setState({ selectedProjectId: project.id, projectStatus: "ready" });
    usePlanningStore.getState().setRequirementText("Changed input");
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: "Save unavailable" }, 503));
    await usePlanningStore.getState().saveCurrentPlanningBrief();
    expect(usePlanningStore.getState()).toMatchObject({
      briefSaveStatus: "error", briefSaveErrorMessage: "Save unavailable", projectErrorMessage: null,
      requirementText: "Changed input",
    });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(persistedBrief));
    await usePlanningStore.getState().saveCurrentPlanningBrief();
    expect(usePlanningStore.getState()).toMatchObject({ briefSaveStatus: "saved", briefSaveErrorMessage: null });
  });

  it("orders autosaves and does not acknowledge newer input with an older response", async () => {
    usePlanningStore.setState({ selectedProjectId: project.id, projectStatus: "ready" });
    usePlanningStore.getState().setRequirementText("First input");
    let finishFirst!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
      .mockResolvedValueOnce(jsonResponse(persistedBrief));
    const first = usePlanningStore.getState().saveCurrentPlanningBrief();
    await vi.waitFor(() => expect(usePlanningStore.getState().briefSaveStatus).toBe("saving"));
    usePlanningStore.getState().setRequirementText("Newer input");
    const second = usePlanningStore.getState().saveCurrentPlanningBrief();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(usePlanningStore.getState().briefSaveStatus).toBe("dirty");
    finishFirst(jsonResponse(persistedBrief));
    await Promise.all([first, second]);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1]![1]?.body)).requirement).toBe("Newer input");
    expect(usePlanningStore.getState().briefSaveStatus).toBe("saved");
  });

  it("ignores autosave errors from a previously selected project", async () => {
    usePlanningStore.setState({ selectedProjectId: project.id, projectStatus: "ready" });
    let finish!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const saving = usePlanningStore.getState().saveCurrentPlanningBrief();
    await vi.waitFor(() => expect(usePlanningStore.getState().briefSaveStatus).toBe("saving"));
    usePlanningStore.setState({ selectedProjectId: "another-project", briefSaveStatus: "idle" });
    finish(jsonResponse({ detail: "Old request failed" }, 503));
    await saving;
    expect(usePlanningStore.getState()).toMatchObject({ briefSaveStatus: "idle", briefSaveErrorMessage: null });
  });

  it("compares input with the result snapshot independently of draft and result edit saves", async () => {
    usePlanningStore.setState({
      selectedProjectId: project.id, projectStatus: "ready", planningResult,
      resultPlanningBrief: persistedBrief, requirementText: persistedBrief.requirement,
      selectedModel: persistedBrief.selectedModel,
      planningBrief: { ...persistedBrief.brief, actionItems: [{ necessity: "required", text: "Implement tests" }] },
    });
    expect(hasUnappliedInput(usePlanningStore.getState())).toBe(false);
    usePlanningStore.getState().setRequirementText("Changed input");
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(persistedBrief));
    await usePlanningStore.getState().saveCurrentPlanningBrief();
    expect(hasUnappliedInput(usePlanningStore.getState())).toBe(true);
    usePlanningStore.getState().setRequirementText("  Build a test plan  ");
    usePlanningStore.getState().setPlanningBriefField("context", ["Web application", "  "]);
    expect(hasUnappliedInput(usePlanningStore.getState())).toBe(false);
    usePlanningStore.getState().setSelectedModel("gpt-5-mini");
    expect(hasUnappliedInput(usePlanningStore.getState())).toBe(true);
  });

  it("detects an unapplied persisted draft after loading the project again", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(planningResult))
      .mockResolvedValueOnce(jsonResponse({ ...persistedBrief, requirement: "New draft" }))
      .mockResolvedValueOnce(jsonResponse(planningHistory))
      .mockResolvedValueOnce(jsonResponse(persistedBrief));
    await usePlanningStore.getState().selectProject(project.id);
    expect(usePlanningStore.getState().briefSaveStatus).toBe("saved");
    expect(hasUnappliedInput(usePlanningStore.getState())).toBe(true);
  });

  it("sends the selected model through the project generation request", async () => {
    usePlanningStore.setState({
      planningBrief: {
        actionItems: [{ necessity: "required", text: "Implement tests" }],
        constraints: "Keep it focused",
        context: ["Web application"],
        planType: "project",
        successCriterion: "quality",
      },
      projects: [project],
      projectStatus: "ready",
      requirementText: "Build a test plan",
      selectedModel: "gpt-5.6-luna",
      selectedProjectId: project.id,
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(planningResult))
      .mockResolvedValueOnce(jsonResponse(planningHistory));

    await usePlanningStore.getState().generateResult();

    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe(
      "http://localhost:8000/projects/project-test/planning/generate",
    );
    expect(JSON.parse(String(init?.body))).toMatchObject({
      options: { model: "gpt-5.6-luna" },
      project: {
        id: project.id,
        title: project.title,
      },
      requirement: "Build a test plan",
    });
    expect(usePlanningStore.getState().status).toBe("ready");
    expect(usePlanningStore.getState().planningHistory).toEqual(planningHistory);
  });

  it("saves graph edits as a new planning result version", async () => {
    const editedResult: PlanningResult = {
      ...planningResult,
      metadata: {
        ...planningResult.metadata,
        editedFromResultId: "planning-result-latest",
      },
      nodes: [
        {
          ...planningResult.nodes[0]!,
          label: "Edited node",
          position: { x: 120, y: 240 },
        },
      ],
    };
    const editedHistory = [
      {
        ...planningHistory[0]!,
        editedFromResultId: "planning-result-latest",
        id: "planning-result-edited",
      },
      ...planningHistory,
    ];
    usePlanningStore.setState({
      planningHistory,
      planningResult,
      selectedPlanningResultId: "planning-result-latest",
      selectedProjectId: project.id,
      status: "ready",
    });

    usePlanningStore.getState().updateNode("node-test", {
      label: "Edited node",
    });
    usePlanningStore.getState().updateNodePosition("node-test", 120, 240);

    expect(usePlanningStore.getState().graphEditStatus).toBe("dirty");
    expect(usePlanningStore.getState().planningResult?.nodes[0]).toMatchObject({
      label: "Edited node",
      position: { x: 120, y: 240 },
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(editedResult))
      .mockResolvedValueOnce(jsonResponse(editedHistory));

    await usePlanningStore.getState().saveGraphEdits();

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe(
      "http://localhost:8000/projects/project-test/planning-results/planning-result-latest/edit",
    );
    expect(init?.method).toBe("POST");
    const editBody = JSON.parse(String(init?.body));
    expect(editBody.nodes[0]).toMatchObject({
      label: "Edited node",
      position: { x: 120, y: 240 },
    });
    expect(editBody.roadmap).toEqual(planningResult.roadmap);
    expect(usePlanningStore.getState().graphEditStatus).toBe("idle");
    expect(usePlanningStore.getState().planningHistory).toEqual(editedHistory);
    expect(usePlanningStore.getState().selectedPlanningResultId).toBe(
      "planning-result-edited",
    );
  });

  it("retains edits, selection and the version token during generation failure and retries explicitly", async () => {
    setLoadedResult();
    usePlanningStore.getState().selectNode("node-test");
    usePlanningStore.getState().updateNode("node-test", { label: "Unsaved node" });
    const before = usePlanningStore.getState();
    let complete!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const generating = usePlanningStore.getState().generateResult();
    expect(usePlanningStore.getState().pendingOperation?.kind).toBe("generate");
    expect(usePlanningStore.getState().planningResult).toBe(before.planningResult);
    expect(usePlanningStore.getState().status).toBe("loading");
    await usePlanningStore.getState().generateResult();
    expect(fetch).toHaveBeenCalledTimes(1);
    complete(jsonResponse({ detail: "AI service unavailable" }, 503));
    await generating;
    expect(usePlanningStore.getState()).toMatchObject({
      planningResult: before.planningResult, selectedNodeId: "node-test", graphEditStatus: "dirty",
      selectedPlanningResultId: before.selectedPlanningResultId, expectedLatestResultId: before.expectedLatestResultId,
      requirementText: before.requirementText, planningBrief: before.planningBrief, status: "ready",
      pendingOperation: null, failedOperation: { kind: "generate", projectId: project.id },
    });
    expect(usePlanningStore.getState().planningResult).toBe(before.planningResult);
    const generated = { ...planningResult, metadata: { ...planningResult.metadata, resultId: "generated-retry" } };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(generated))
      .mockResolvedValueOnce(jsonResponse([{ ...planningHistory[0]!, id: "generated-retry" }, ...planningHistory]));
    await usePlanningStore.getState().retryFailedOperation();
    expect(usePlanningStore.getState()).toMatchObject({
      planningResult: generated, selectedPlanningResultId: "generated-retry", expectedLatestResultId: "generated-retry",
      failedOperation: null, errorMessage: null, graphEditStatus: "idle", status: "ready",
    });
    expect(hasUnappliedInput(usePlanningStore.getState())).toBe(false);
  });

  it("preserves the input after an initial generation failure without inventing a result", async () => {
    setLoadedResult();
    usePlanningStore.setState({ planningResult: null, selectedPlanningResultId: null });
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await usePlanningStore.getState().generateResult();
    expect(usePlanningStore.getState()).toMatchObject({ planningResult: null, requirementText: persistedBrief.requirement,
      status: "error", pendingOperation: null, failedOperation: { kind: "generate" } });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps a successful generation and its token when only history loading fails", async () => {
    setLoadedResult();
    const generated = { ...planningResult, metadata: { ...planningResult.metadata, resultId: "generated-with-history-error" } };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(generated))
      .mockResolvedValueOnce(jsonResponse({ detail: "History unavailable" }, 503));
    await usePlanningStore.getState().generateResult();
    expect(usePlanningStore.getState()).toMatchObject({ planningResult: generated, planningHistory,
      selectedPlanningResultId: "generated-with-history-error", expectedLatestResultId: "generated-with-history-error",
      status: "ready", failedOperation: null, historyStatus: "error", historyErrorMessage: "History unavailable" });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([{ ...planningHistory[0]!, id: "generated-with-history-error" }]));
    await usePlanningStore.getState().loadPlanningHistory(project.id);
    expect(usePlanningStore.getState().historyStatus).toBe("ready");
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("retries the failed project instead of showing a previous project's graph", async () => {
    setLoadedResult();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: "Project unavailable" }, 503))
      .mockResolvedValueOnce(jsonResponse(persistedBrief)).mockResolvedValueOnce(jsonResponse(planningHistory));
    await usePlanningStore.getState().selectProject("target-project");
    expect(usePlanningStore.getState()).toMatchObject({ selectedProjectId: "target-project", planningResult: null,
      status: "error", failedOperation: { kind: "project", projectId: "target-project" } });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(planningResult)).mockResolvedValueOnce(jsonResponse(persistedBrief))
      .mockResolvedValueOnce(jsonResponse(planningHistory)).mockResolvedValueOnce(jsonResponse(persistedBrief));
    await usePlanningStore.getState().retryFailedOperation();
    expect(usePlanningStore.getState()).toMatchObject({ status: "ready", pendingOperation: null, failedOperation: null });
    expect(vi.mocked(fetch).mock.calls[3]![0]).toBe("http://localhost:8000/projects/target-project/planning-results/latest");
  });

  it("preserves the displayed version and edits when another version fails to load", async () => {
    setLoadedResult();
    usePlanningStore.getState().updateNode("node-test", { label: "Keep this edit" });
    const before = usePlanningStore.getState();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: "Version unavailable" }, 503))
      .mockResolvedValueOnce(jsonResponse(persistedBrief));
    await usePlanningStore.getState().selectPlanningResult("older-version");
    expect(usePlanningStore.getState()).toMatchObject({ planningResult: before.planningResult,
      selectedPlanningResultId: before.selectedPlanningResultId, graphEditStatus: "dirty", status: "ready",
      failedOperation: { kind: "version", projectId: project.id, resultId: "older-version" } });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ...planningResult, summary: "Historical version" }))
      .mockResolvedValueOnce(jsonResponse(persistedBrief));
    await usePlanningStore.getState().retryFailedOperation();
    expect(usePlanningStore.getState()).toMatchObject({ selectedPlanningResultId: "older-version",
      planningResult: { summary: "Historical version" }, failedOperation: null, graphEditStatus: "idle" });
  });

  it("ignores a late failure from an older project request", async () => {
    let complete!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }))
      .mockResolvedValueOnce(jsonResponse(persistedBrief)).mockResolvedValueOnce(jsonResponse(planningHistory));
    const oldRequest = usePlanningStore.getState().selectProject("old-project");
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(planningResult)).mockResolvedValueOnce(jsonResponse(persistedBrief))
      .mockResolvedValueOnce(jsonResponse(planningHistory)).mockResolvedValueOnce(jsonResponse(persistedBrief));
    await usePlanningStore.getState().selectProject("new-project");
    complete(jsonResponse({ detail: "Late error" }, 503));
    await oldRequest;
    expect(usePlanningStore.getState()).toMatchObject({ selectedProjectId: "new-project", planningResult,
      status: "ready", failedOperation: null, errorMessage: null });
  });

  it("ignores generation completion after reset", async () => {
    setLoadedResult();
    let complete!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const generating = usePlanningStore.getState().generateResult();
    usePlanningStore.getState().resetToEmpty();
    complete(jsonResponse(planningResult));
    await generating;
    expect(usePlanningStore.getState()).toMatchObject({ planningResult: null, status: "empty", pendingOperation: null, failedOperation: null });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("shares selection between nodes and roadmap steps without discarding edits", () => {
    usePlanningStore.setState({ planningResult: structuredClone(mockPlanningResult), status: "ready" });
    const nodeId = mockPlanningResult.nodes[0]!.id;
    const stepId = mockPlanningResult.roadmap[0]!.id;
    usePlanningStore.getState().selectNode(nodeId);
    usePlanningStore.getState().updateNode(nodeId, { label: "Keep node edit" });
    usePlanningStore.getState().selectRoadmapStep(stepId);
    expect(usePlanningStore.getState()).toMatchObject({ selectedNodeId: null, selectedRoadmapStepId: stepId, graphEditStatus: "dirty" });
    usePlanningStore.getState().updateRoadmapStep(stepId, { title: "Keep step edit" });
    usePlanningStore.getState().selectNode(nodeId);
    expect(usePlanningStore.getState()).toMatchObject({ selectedNodeId: nodeId, selectedRoadmapStepId: null, graphEditStatus: "dirty" });
    expect(usePlanningStore.getState().planningResult?.nodes[0]?.label).toBe("Keep node edit");
    expect(usePlanningStore.getState().planningResult?.roadmap[0]?.title).toBe("Keep step edit");
  });

  it("selects newly added steps, tracks selection by ID through sorting and clears deleted selection", () => {
    usePlanningStore.setState({ planningResult: structuredClone(mockPlanningResult), status: "ready" });
    usePlanningStore.getState().addRoadmapStep();
    const stepId = usePlanningStore.getState().selectedRoadmapStepId!;
    expect(stepId).toBeTruthy();
    const originalFirstId = mockPlanningResult.roadmap[0]!.id;
    usePlanningStore.getState().updateRoadmapStep(originalFirstId, { dependsOn: [stepId] });
    expect(usePlanningStore.getState().selectedRoadmapStepId).toBe(stepId);
    expect(usePlanningStore.getState().planningResult?.roadmap[0]?.id).toBe(stepId);
    usePlanningStore.getState().removeRoadmapStep(stepId);
    expect(usePlanningStore.getState().selectedRoadmapStepId).toBeNull();
    usePlanningStore.getState().selectRoadmapStep(originalFirstId);
    usePlanningStore.getState().addNode();
    expect(usePlanningStore.getState().selectedRoadmapStepId).toBeNull();
    expect(usePlanningStore.getState().selectedNodeId).toBeTruthy();
    usePlanningStore.getState().selectRoadmapStep(originalFirstId);
    usePlanningStore.getState().resetToEmpty();
    expect(usePlanningStore.getState().selectedRoadmapStepId).toBeNull();
  });

  it("adds unique nodes and deletes their connections and roadmap references without mutating the source", () => {
    const source = structuredClone(mockPlanningResult);
    const snapshot = structuredClone(source);
    usePlanningStore.setState({ planningResult: source, status: "ready" });
    usePlanningStore.getState().addNode();
    const addedId = usePlanningStore.getState().selectedNodeId!;
    usePlanningStore.getState().addNode();
    expect(usePlanningStore.getState().selectedNodeId).not.toBe(addedId);
    usePlanningStore.getState().addEdge(source.nodes[0]!.id, addedId, "requires");
    expect(validatePlanningResult(usePlanningStore.getState().planningResult!).valid).toBe(true);
    usePlanningStore.getState().selectNode(source.nodes[0]!.id);
    usePlanningStore.getState().removeNode(source.nodes[0]!.id);
    const state = usePlanningStore.getState();
    expect(state.selectedNodeId).toBeNull();
    expect(state.graphEditStatus).toBe("dirty");
    expect(validatePlanningResult(state.planningResult!).valid).toBe(true);
    expect(state.planningResult!.edges.every((edge) => edge.source !== source.nodes[0]!.id && edge.target !== source.nodes[0]!.id)).toBe(true);
    expect(state.planningResult!.roadmap.every((step) => !step.componentNodeIds?.includes(source.nodes[0]!.id))).toBe(true);
    expect(source).toEqual(snapshot);
  });

  it("rejects the last node deletion, self connections, duplicate connections and missing endpoints", () => {
    usePlanningStore.setState({ planningResult: structuredClone(planningResult), status: "ready" });
    const state = usePlanningStore.getState();
    state.removeNode("node-test");
    expect(usePlanningStore.getState().planningResult!.nodes).toHaveLength(1);
    expect(usePlanningStore.getState().graphEditStatus).toBe("idle");
    state.addEdge("node-test", "node-test", "requires");
    expect(usePlanningStore.getState().graphEditErrorMessage).toContain("자기 자신");
    state.addEdge("node-test", "missing", "requires");
    expect(usePlanningStore.getState().planningResult!.edges).toHaveLength(0);
    state.addNode();
    const id = usePlanningStore.getState().selectedNodeId!;
    state.addEdge("node-test", id, "requires");
    state.addEdge("node-test", id, "requires");
    state.addEdge("node-test", id, "feeds");
    expect(usePlanningStore.getState().planningResult!.edges).toHaveLength(1);
    expect(usePlanningStore.getState().graphEditErrorMessage).toContain("이미");
    state.removeEdge(usePlanningStore.getState().planningResult!.edges[0]!.id);
    expect(usePlanningStore.getState().planningResult!.edges).toHaveLength(0);
    state.removeNode(id);
    expect(usePlanningStore.getState().planningResult!.nodes).toHaveLength(1);
  });

  it("saves graph structure and prevents structural edits while a save is in flight", async () => {
    usePlanningStore.setState({ planningResult: structuredClone(planningResult), status: "ready",
      selectedProjectId: project.id, selectedPlanningResultId: "source", expectedLatestResultId: "source" });
    usePlanningStore.getState().addNode();
    const id = usePlanningStore.getState().selectedNodeId!;
    usePlanningStore.getState().addEdge("node-test", id, "feeds");
    const draft = usePlanningStore.getState().planningResult!;
    let finish!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce(jsonResponse([{ ...planningHistory[0], id: "saved" }]));
    const save = usePlanningStore.getState().saveGraphEdits();
    usePlanningStore.getState().addNode();
    usePlanningStore.getState().removeNode(id);
    usePlanningStore.getState().removeEdge(draft.edges[0]!.id);
    expect(usePlanningStore.getState().planningResult).toBe(draft);
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
    expect(body).toMatchObject({ nodes: draft.nodes, edges: draft.edges, expectedLatestResultId: "source" });
    finish(jsonResponse({ ...draft, metadata: { ...draft.metadata, resultId: "saved" } }));
    await save;
    expect(usePlanningStore.getState().graphEditStatus).toBe("idle");
    expect(usePlanningStore.getState().planningResult!.edges).toEqual(draft.edges);
  });

  it("reconnects an edge without changing its ID and rejects invalid or duplicate updates", () => {
    usePlanningStore.setState({ planningResult: structuredClone(mockPlanningResult), status: "ready" });
    const state = usePlanningStore.getState();
    state.addNode();
    const newId = usePlanningStore.getState().selectedNodeId!;
    const edge = mockPlanningResult.edges[0]!;
    state.updateEdge(edge.id, { target: newId, dependencyType: "related" });
    expect(usePlanningStore.getState().planningResult!.edges.find((item) => item.id === edge.id))
      .toMatchObject({ id: edge.id, source: edge.source, target: newId, dependencyType: "related" });
    const updated = usePlanningStore.getState().planningResult;
    state.updateEdge(edge.id, { target: edge.source });
    state.updateEdge(edge.id, { target: "missing" });
    expect(usePlanningStore.getState().planningResult).toBe(updated);
    state.addEdge(edge.source, newId, "requires");
    expect(usePlanningStore.getState().graphEditErrorMessage).toContain("이미");
    const occupied = mockPlanningResult.edges[1]!;
    state.updateEdge(edge.id, { source: occupied.source, target: occupied.target, dependencyType: "related" });
    expect(usePlanningStore.getState().graphEditErrorMessage).toContain("이미");
    expect(usePlanningStore.getState().planningResult!.edges.find((item) => item.id === edge.id)!.dependencyType).toBe("related");
    // A single existing edge can still change its own type.
    state.updateEdge(edge.id, { dependencyType: "requires" });
    expect(usePlanningStore.getState().planningResult!.edges.find((item) => item.id === edge.id)!.dependencyType).toBe("requires");
    usePlanningStore.setState({ graphEditStatus: "saving" });
    const saving = usePlanningStore.getState().planningResult;
    state.updateEdge(edge.id, { target: edge.target });
    expect(usePlanningStore.getState().planningResult).toBe(saving);
  });

  it("rejects parallel edges of different types in the shared contract", () => {
    const result = structuredClone(mockPlanningResult);
    const edge = result.edges[0]!;
    result.edges.push({ ...edge, id: "parallel-edge", dependencyType: edge.dependencyType === "related" ? "feeds" : "related" });
    const validation = validatePlanningResult(result);
    expect(validation.valid).toBe(false);
    expect(validation.issues).toContainEqual(expect.objectContaining({ message: "Duplicate connections are not allowed." }));
  });

  it("edits roadmap fields and rejects an order that breaks dependencies", () => {
    const resultWithRoadmap: PlanningResult = {
      ...planningResult,
      roadmap: [
        {
          dependsOn: [],
          description: "First",
          estimatedEffort: "small",
          id: "step-one",
          order: 1,
          priority: "high",
          title: "First step",
        },
        {
          dependsOn: ["step-one"],
          description: "Second",
          estimatedEffort: "large",
          id: "step-two",
          order: 2,
          priority: "medium",
          title: "Second step",
        },
      ],
    };
    usePlanningStore.setState({
      graphEditErrorMessage: null,
      graphEditStatus: "idle",
      planningResult: resultWithRoadmap,
      status: "ready",
    });

    usePlanningStore.getState().updateRoadmapStep("step-one", {
      estimatedEffort: "medium",
      priority: "low",
      title: "Edited first step",
    });
    expect(usePlanningStore.getState().planningResult?.roadmap[0]).toMatchObject({
      estimatedEffort: "medium",
      priority: "low",
      title: "Edited first step",
    });
    expect(usePlanningStore.getState().graphEditStatus).toBe("dirty");

    usePlanningStore.getState().moveRoadmapStep("step-one", 1);
    expect(usePlanningStore.getState().planningResult?.roadmap[0]?.id).toBe("step-one");
    expect(usePlanningStore.getState().graphEditErrorMessage).toContain("선행 단계");
  });

  it("adds, links, topologically orders and deletes roadmap steps without mutating history", () => {
    const source = structuredClone(mockPlanningResult);
    source.roadmap = [];
    const original = structuredClone(source);
    usePlanningStore.setState({ planningResult: source, status: "ready" });
    const state = usePlanningStore.getState();
    state.addRoadmapStep();
    state.addRoadmapStep();
    const [first, second] = usePlanningStore.getState().planningResult!.roadmap;
    expect(first!.id).not.toBe(second!.id);
    state.updateRoadmapStep(first!.id, { componentNodeIds: [source.nodes[0]!.id], dependsOn: [second!.id] });
    const reordered = usePlanningStore.getState().planningResult!;
    expect(reordered.roadmap.map((step) => step.id)).toEqual([second!.id, first!.id]);
    expect(reordered.roadmap.map((step) => step.order)).toEqual([1, 2]);
    expect(validatePlanningResult(reordered).valid).toBe(true);
    state.updateRoadmapStep(second!.id, { dependsOn: [first!.id] });
    expect(usePlanningStore.getState().planningResult).toBe(reordered);
    expect(usePlanningStore.getState().graphEditErrorMessage).toContain("순환 의존성");
    state.updateRoadmapStep(first!.id, { componentNodeIds: ["missing-node"] });
    expect(usePlanningStore.getState().planningResult).toBe(reordered);
    state.updateRoadmapStep(first!.id, { dependsOn: [second!.id, second!.id] });
    expect(usePlanningStore.getState().planningResult).toBe(reordered);
    state.removeRoadmapStep(second!.id);
    expect(usePlanningStore.getState().planningResult!.roadmap).toEqual([expect.objectContaining({ id: first!.id, order: 1, dependsOn: [] })]);
    state.updateRoadmapStep(first!.id, { componentNodeIds: [] });
    expect(usePlanningStore.getState().planningResult!.roadmap[0]!.componentNodeIds).toEqual([]);
    state.removeRoadmapStep(first!.id);
    expect(usePlanningStore.getState().planningResult!.roadmap).toEqual([]);
    expect(validatePlanningResult(usePlanningStore.getState().planningResult!).valid).toBe(true);
    state.addRoadmapStep();
    expect(usePlanningStore.getState().planningResult!.roadmap[0]!.order).toBe(1);
    expect(source).toEqual(original);
  });

  it("keeps roadmap edits unchanged during saving and ignores missing steps", () => {
    const result = structuredClone(mockPlanningResult);
    usePlanningStore.setState({ planningResult: result, status: "ready", graphEditStatus: "saving" });
    const state = usePlanningStore.getState();
    state.addRoadmapStep();
    state.removeRoadmapStep(result.roadmap[0]!.id);
    state.updateRoadmapStep(result.roadmap[0]!.id, { title: "Blocked" });
    state.moveRoadmapStep(result.roadmap[0]!.id, 1);
    expect(usePlanningStore.getState().planningResult).toBe(result);
    usePlanningStore.setState({ graphEditStatus: "idle" });
    state.removeRoadmapStep("missing");
    state.updateRoadmapStep("missing", { title: "Unknown" });
    expect(usePlanningStore.getState().graphEditStatus).toBe("idle");
  });

  it("rejects roadmap cycles, noncontiguous order and duplicate references in the shared contract", () => {
    const result = structuredClone(mockPlanningResult);
    result.roadmap[0]!.dependsOn = [result.roadmap[1]!.id];
    expect(validatePlanningResult(result).valid).toBe(false);
    result.roadmap[0]!.dependsOn = [];
    result.roadmap[0]!.componentNodeIds = [result.nodes[0]!.id, result.nodes[0]!.id];
    expect(validatePlanningResult(result).valid).toBe(false);
    result.roadmap[0]!.componentNodeIds = [];
    result.roadmap[0]!.order = 100;
    expect(validatePlanningResult(result).valid).toBe(false);
  });

  it("loads a selected historical planning result", async () => {
    const historicalResult = { ...planningResult, summary: "Older plan" };
    usePlanningStore.setState({
      planningHistory,
      selectedPlanningResultId: "planning-result-latest",
      selectedProjectId: project.id,
    });
    const historicalBrief = {
      ...persistedBrief,
      brief: {
        ...persistedBrief.brief,
        constraints: "Older constraint",
      },
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(historicalResult))
      .mockResolvedValueOnce(jsonResponse(historicalBrief));

    await usePlanningStore
      .getState()
      .selectPlanningResult("planning-result-older");

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/projects/project-test/planning-results/planning-result-older",
      undefined,
    );
    expect(usePlanningStore.getState().planningResult?.summary).toBe(
      "Older plan",
    );
    expect(usePlanningStore.getState().planningBrief.constraints).toBe(
      "Older constraint",
    );
    expect(usePlanningStore.getState().isViewingHistoricalResult).toBe(true);
    expect(usePlanningStore.getState().selectedPlanningResultId).toBe(
      "planning-result-older",
    );
  });

  it("does not autosave while viewing a historical result", async () => {
    usePlanningStore.setState({
      isViewingHistoricalResult: true,
      projectStatus: "ready",
      selectedProjectId: project.id,
    });

    await usePlanningStore.getState().saveCurrentPlanningBrief();

    expect(fetch).not.toHaveBeenCalled();
  });

  it("restores a historical result and its planning brief as a new version", async () => {
    const restoredHistory = [
      {
        ...planningHistory[0]!,
        id: "planning-result-restored",
        restoredFromResultId: "planning-result-latest",
      },
      ...planningHistory,
    ];
    usePlanningStore.setState({
      models: [lunaModel],
      planningHistory,
      selectedPlanningResultId: "planning-result-latest",
      selectedProjectId: project.id,
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          planningBrief: persistedBrief,
          result: planningResult,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(restoredHistory));

    await usePlanningStore.getState().restoreSelectedPlanningResult();

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8000/projects/project-test/planning-results/planning-result-latest/restore",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedLatestResultId: "planning-result-latest" }) },
    );
    const state = usePlanningStore.getState();
    expect(state.requirementText).toBe(persistedBrief.requirement);
    expect(state.planningBrief.actionItems[0]?.text).toBe("Implement tests");
    expect(state.selectedPlanningResultId).toBe("planning-result-restored");
    expect(state.planningHistory).toEqual(restoredHistory);
  });

  it("keeps project viewing available when model catalog loading fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ detail: "Model catalog unavailable." }, 503),
    );

    await usePlanningStore.getState().loadModels();

    const state = usePlanningStore.getState();
    expect(state.modelStatus).toBe("error");
    expect(state.modelErrorMessage).toBe("Model catalog unavailable.");
    expect(state.selectedModel).toBe("");
    expect(state.status).toBe("idle");
  });

  it("preserves local edits on conflict and retries against the observed head only after resolution", async () => {
    usePlanningStore.setState({ planningHistory, planningResult, selectedPlanningResultId: "planning-result-latest", selectedProjectId: project.id, status: "ready" });
    usePlanningStore.getState().updateNode("node-test", { label: "Local draft" });
    const concurrentHistory = [{ ...planningHistory[0]!, id: "concurrent-head" }, ...planningHistory];
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ detail: { code: "planning_version_conflict", message: "Version conflict", latestResultId: "concurrent-head" } }, 409))
      .mockResolvedValueOnce(jsonResponse(concurrentHistory));
    await usePlanningStore.getState().saveGraphEdits();
    expect(usePlanningStore.getState().planningResult?.nodes[0]?.label).toBe("Local draft");
    expect(usePlanningStore.getState().selectedPlanningResultId).toBe("planning-result-latest");
    expect(usePlanningStore.getState().versionConflict).toBe("edit");
    await usePlanningStore.getState().saveGraphEdits();
    expect(fetch).toHaveBeenCalledTimes(2);
    const draft = usePlanningStore.getState().planningResult;
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(draft)).mockResolvedValueOnce(jsonResponse([{ ...planningHistory[0]!, id: "saved-draft" }, ...concurrentHistory]));
    await usePlanningStore.getState().resolveVersionConflict(true);
    const retry = vi.mocked(fetch).mock.calls[2]!;
    expect(JSON.parse(String(retry[1]?.body))).toMatchObject({ expectedLatestResultId: "concurrent-head", nodes: [expect.objectContaining({ label: "Local draft" })] });
    expect(usePlanningStore.getState().versionConflict).toBeNull();
  });

  it("preserves the historical preview when restore conflicts", async () => {
    usePlanningStore.setState({ planningHistory, planningResult, selectedPlanningResultId: "old-source", selectedProjectId: project.id, isViewingHistoricalResult: true, status: "ready" });
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ detail: { code: "planning_version_conflict", message: "Version conflict", latestResultId: "new-head" } }, 409))
      .mockResolvedValueOnce(jsonResponse([{ ...planningHistory[0]!, id: "new-head" }, ...planningHistory]));
    await usePlanningStore.getState().restoreSelectedPlanningResult();
    expect(usePlanningStore.getState().planningResult).toEqual(planningResult);
    expect(usePlanningStore.getState().selectedPlanningResultId).toBe("old-source");
    expect(usePlanningStore.getState().status).toBe("ready");
    expect(usePlanningStore.getState().isViewingHistoricalResult).toBe(true);
    expect(usePlanningStore.getState().versionConflict).toBe("restore");
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ planningBrief: persistedBrief, result: planningResult }))
      .mockResolvedValueOnce(jsonResponse([{ ...planningHistory[0]!, id: "restored-head" }]));
    await usePlanningStore.getState().restoreSelectedPlanningResult();
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[2]![1]?.body))).toEqual({ expectedLatestResultId: "new-head" });
    expect(usePlanningStore.getState().versionConflict).toBeNull();
  });

  it("loads the exact history version when the head advances between initial requests", async () => {
    const first = { ...planningResult, metadata: { ...planningResult.metadata, resultId: "first-head" } };
    const newer = { ...planningResult, summary: "Concurrent result", metadata: { ...planningResult.metadata, resultId: "second-head" } };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(first))
      .mockResolvedValueOnce(jsonResponse(persistedBrief))
      .mockResolvedValueOnce(jsonResponse([{ ...planningHistory[0]!, id: "second-head" }]))
      .mockResolvedValueOnce(jsonResponse(newer));
    await usePlanningStore.getState().selectProject(project.id);
    expect(usePlanningStore.getState().planningResult?.summary).toBe("Concurrent result");
    expect(usePlanningStore.getState().selectedPlanningResultId).toBe("second-head");
    expect(usePlanningStore.getState().expectedLatestResultId).toBe("second-head");
  });

  it("keeps the saved snapshot as its concurrency token even if another save precedes the history refresh", async () => {
    usePlanningStore.setState({ selectedProjectId: project.id, planningResult: { ...planningResult, metadata: { ...planningResult.metadata, resultId: "my-saved-version" } } });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([{ ...planningHistory[0]!, id: "other-saved-version" }, { ...planningHistory[0]!, id: "my-saved-version" }]));
    await usePlanningStore.getState().loadPlanningHistory(project.id);
    expect(usePlanningStore.getState().selectedPlanningResultId).toBe("my-saved-version");
    expect(usePlanningStore.getState().expectedLatestResultId).toBe("my-saved-version");
  });
});
