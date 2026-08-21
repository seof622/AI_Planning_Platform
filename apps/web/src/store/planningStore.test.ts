import type {
  PlanningResult,
  Project,
} from "@ai-planning-platform/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlanningStore } from "./planningStore";

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
      { method: "POST" },
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
});
