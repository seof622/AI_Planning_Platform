import type {
  PlanningResult,
  Project,
} from "@ai-planning-platform/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlanningStore } from "./planningStore";
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

describe("planningStore", () => {
  beforeEach(() => {
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
      .mockResolvedValueOnce(jsonResponse(planningHistory));

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
    usePlanningStore.setState({ planningResult: { ...planningResult, metadata: { ...planningResult.metadata, resultId: "my-saved-version" } } });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([{ ...planningHistory[0]!, id: "other-saved-version" }, { ...planningHistory[0]!, id: "my-saved-version" }]));
    await usePlanningStore.getState().loadPlanningHistory(project.id);
    expect(usePlanningStore.getState().selectedPlanningResultId).toBe("my-saved-version");
    expect(usePlanningStore.getState().expectedLatestResultId).toBe("my-saved-version");
  });
});
