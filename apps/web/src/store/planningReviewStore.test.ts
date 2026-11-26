import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPlanningReview, mockReviewRun, sameReviewInput, validateInputFeedback } from "@ai-planning-platform/shared";
import { usePlanningStore } from "./planningStore";
import { usePlanningReviewStore } from "./planningReviewStore";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const reviewed = { review: mockPlanningReview, run: mockReviewRun, result: null };

function setCurrentReview() {
  usePlanningReviewStore.setState({ review: structuredClone(mockPlanningReview), status: "ready" });
}

describe("input review workflow", () => {
  beforeEach(() => {
    usePlanningStore.setState(usePlanningStore.getInitialState(), true);
    usePlanningReviewStore.setState(usePlanningReviewStore.getInitialState(), true);
    usePlanningStore.setState({ selectedProjectId: mockPlanningReview.projectId, requirementText: mockPlanningReview.input.requirement,
      planningBrief: { context: [], actionItems: [], constraints: "", planType: "project", successCriterion: "clarity" },
      selectedModel: "gpt-5-mini", models: [{ id: "gpt-5-mini", label: "Mini", quality: "standard", cost: "low", speed: "fast", description: "테스트", recommendedFor: "테스트" }],
    });
    usePlanningReviewStore.getState().syncProject(mockPlanningReview.projectId);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("reviews sparse input without generating or overwriting the chosen model", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(reviewed));
    await usePlanningReviewStore.getState().startReview();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0]![0])).toMatch(/planning-reviews$/);
    expect(usePlanningReviewStore.getState()).toMatchObject({ status: "ready", review: mockPlanningReview });
    expect(usePlanningStore.getState().selectedModel).toBe("gpt-5-mini");
  });

  it("invalidates an input change and sends no generation from an expired review", async () => {
    setCurrentReview();
    usePlanningStore.getState().setRequirementText("바뀐 목표");
    usePlanningReviewStore.getState().invalidate();
    expect(usePlanningReviewStore.getState().status).toBe("expired");
    await usePlanningReviewStore.getState().confirmAndGenerate();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps model preference separate and requires re-review when preference changes", () => {
    setCurrentReview();
    usePlanningReviewStore.getState().setPreference("cost");
    expect(usePlanningReviewStore.getState().status).toBe("expired");
    expect(usePlanningReviewStore.getState().review?.feedback).toEqual(mockPlanningReview.feedback);
  });

  it("recovers an uncertain review using the same request key", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await usePlanningReviewStore.getState().startReview();
    const pending = usePlanningReviewStore.getState().pending!;
    expect(usePlanningReviewStore.getState().status).toBe("uncertain");
    vi.mocked(fetch).mockResolvedValueOnce(response({ detail: "not registered" }, 404)).mockResolvedValueOnce(response(reviewed));
    await usePlanningReviewStore.getState().checkExecution();
    const secondPost = vi.mocked(fetch).mock.calls[2]!;
    expect(JSON.parse(String(secondPost[1]?.body)).idempotencyKey).toBe(pending.key);
    expect(usePlanningReviewStore.getState().status).toBe("ready");
  });

  it("ignores a late response after changing projects", async () => {
    let finish!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const reviewing = usePlanningReviewStore.getState().startReview();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    usePlanningReviewStore.getState().syncProject("another-project");
    usePlanningStore.setState({ selectedProjectId: "another-project" });
    finish(response(reviewed));
    await reviewing;
    expect(usePlanningReviewStore.getState()).toMatchObject({ projectId: "another-project", review: null, status: "idle" });
  });

  it("records the chosen model and its recommendation acceptance independently", async () => {
    setCurrentReview();
    vi.mocked(fetch).mockResolvedValueOnce(response({ id: "selection" }));
    await usePlanningReviewStore.getState().selectModel("gpt-5.6-sol");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]![1]?.body))).toMatchObject({ kind: "selection", selectedModel: "gpt-5.6-sol" });
    expect(usePlanningReviewStore.getState().status).toBe("ready");
    expect(usePlanningStore.getState().selectedModel).toBe("gpt-5.6-sol");
  });

  it("does not call the API when generation has no final confirmation", async () => {
    await usePlanningStore.getState().generateResult();
    expect(fetch).not.toHaveBeenCalled();
    expect(usePlanningStore.getState().errorMessage).toMatch(/확인/);
  });

  it("rejects invalid AI estimates at the runtime boundary", () => {
    expect(validateInputFeedback(mockPlanningReview.feedback)).toBe(true);
    const invalid = structuredClone(mockPlanningReview.feedback!);
    invalid.assessment.expertise.missingInformation = null;
    expect(validateInputFeedback(invalid)).toBe(false);
    invalid.assessment.expertise.value = 2.5;
    expect(validateInputFeedback(invalid)).toBe(false);
  });

  it("normalizes line endings, Unicode and blank entries without changing semantic fields", () => {
    const original = mockPlanningReview.input;
    expect(sameReviewInput(original, { ...original, requirement: `  ${original.requirement}\r\n`,
      brief: { ...original.brief, context: [" "] } })).toBe(true);
    expect(sameReviewInput(original, { ...original, preference: "quality" })).toBe(false);
  });
});
