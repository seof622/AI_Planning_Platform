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
          { id: "gpt-5-mini", label: "GPT-5 mini" },
          { id: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
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
      models: [{ id: "gpt-5.6-luna", label: "GPT-5.6 Luna" }],
      modelStatus: "ready",
      selectedModel: "gpt-5.6-luna",
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse([project]))
      .mockResolvedValueOnce(jsonResponse(planningResult))
      .mockResolvedValueOnce(jsonResponse(persistedBrief));

    await usePlanningStore.getState().loadProjects();

    const state = usePlanningStore.getState();
    expect(state.selectedProjectId).toBe(project.id);
    expect(state.planningResult?.summary).toBe("Test plan");
    expect(state.requirementText).toBe("Build a test plan");
    expect(state.planningBrief.actionItems[0]?.text).toBe("Implement tests");
    expect(state.planningBrief.constraints).toBe("Keep it focused");
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
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(planningResult));

    await usePlanningStore.getState().generateResult();

    expect(fetch).toHaveBeenCalledTimes(1);
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
