import { expect, type Page, type Route } from "@playwright/test";
import { mockPlanningReview, mockReviewRun, type PlanningReview, type PlanningResult, type ProjectPlanningBrief,
  type PlanningDecision, type AIExecutionRun, type ReviewInput } from "@ai-planning-platform/shared";

/** Review fixture for browser regressions; actual DB/API behavior is covered separately. */
export function createReviewFixture(projectId: string, getDraft: () => ProjectPlanningBrief, options: { questions?: boolean } = {}) {
  const reviews: PlanningReview[] = [];
  const decisions: PlanningDecision[] = [];
  const runs: AIExecutionRun[] = [];
  return {
    reviews, decisions, runs,
    async route(route: Route): Promise<boolean> {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path.endsWith("/planning-reviews")) {
        if (request.method() === "POST") {
          const body = request.postDataJSON();
          const input = body.input as ReviewInput;
          // The API returns action item fields in PostgreSQL JSONB order.
          input.brief.actionItems = input.brief.actionItems.map(({ necessity, title }) => ({ title, necessity }));
          const review: PlanningReview = { ...structuredClone(mockPlanningReview), id: `review-${reviews.length + 1}`, projectId,
            input, parentReviewId: body.parentReviewId ?? null,
            feedback: { ...structuredClone(mockPlanningReview.feedback!), questions: options.questions && !body.input.brief.context.length ? mockPlanningReview.feedback!.questions : [] },
            recommendation: { ...mockPlanningReview.recommendation!, model: getDraft().selectedModel ?? "mock", allowedModels: [getDraft().selectedModel ?? "mock"] } };
          reviews.unshift(review);
          const run: AIExecutionRun = { ...mockReviewRun, id: `review-run-${reviews.length}`, projectId, reviewId: review.id, idempotencyKey: body.idempotencyKey };
          runs.push(run);
          await route.fulfill({ json: { review, run, result: null } });
        } else await route.fulfill({ json: reviews });
        return true;
      }
      const decision = path.match(/\/planning-reviews\/([^/]+)\/decisions$/);
      if (decision) {
        const body = request.postDataJSON();
        const review = reviews.find((item) => item.id === decision[1])!;
        const item: PlanningDecision = { id: `decision-${decisions.length + 1}`, projectId, reviewId: review.id, kind: body.kind,
          selectedModel: body.selectedModel, acceptedRecommendation: body.selectedModel === review.recommendation?.model,
          snapshot: { input: review.input, selectedModel: body.selectedModel, assumptions: review.feedback?.assumptions ?? [] }, createdAt: review.createdAt };
        decisions.push(item);
        await route.fulfill({ json: item }); return true;
      }
      const detail = path.match(/\/planning-reviews\/([^/]+)$/);
      if (detail) {
        const review = reviews.find((item) => item.id === detail[1]);
        await route.fulfill({ status: review ? 200 : 404, json: review ? { review, decisions: decisions.filter((item) => item.reviewId === review.id),
          runs: runs.filter((item) => item.reviewId === review.id) } : { detail: "No review" } }); return true;
      }
      if (path.includes("/ai-execution-runs/by-key/")) {
        await route.fulfill({ status: 404, json: { detail: "No run" } }); return true;
      }
      return false;
    },
    generationBody() {
      const decision = decisions.filter((item) => item.kind === "confirmation").at(-1)!;
      return { requirement: decision.snapshot.input.requirement, brief: decision.snapshot.input.brief, options: { model: decision.selectedModel } };
    },
    generationResponse(result: PlanningResult, key: string) {
      const decision = decisions.filter((item) => item.kind === "confirmation").at(-1)!;
      const run: AIExecutionRun = { ...mockReviewRun, projectId, id: `generation-run-${runs.length}`, kind: "generation",
        reviewId: decision.reviewId, confirmationId: decision.id, resultId: result.metadata.resultId ?? null, idempotencyKey: key };
      runs.push(run);
      return { result, run, review: reviews.find((item) => item.id === decision.reviewId)! };
    },
  };
}

export async function reviewAndGenerate(page: Page) {
  await page.getByRole("button", { name: "AI 입력 검토", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "AI 입력 검토", exact: true });
  await expect(dialog.getByRole("heading", { name: "AI가 이해한 목표", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "최종 내용 확인", exact: true }).click();
  await dialog.getByRole("checkbox", { name: "최종 입력과 위 진행 가정을 확인했습니다.", exact: true }).check();
  await dialog.getByRole("button", { name: "확인하고 계획 생성", exact: true }).click();
}
