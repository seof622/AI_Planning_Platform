import { expect, test, type Page } from "@playwright/test";
import { mockPlanningResult, mockPlanningReview, type PlanningResult, type ProjectPlanningBrief } from "@ai-planning-platform/shared";
import { createReviewFixture } from "./reviewHelpers";

async function setup(page: Page, options: { failReview?: boolean } = {}) {
  const project = { ...mockPlanningResult.project!, id: mockPlanningReview.projectId, title: "입력 검토 테스트" };
  let draft: ProjectPlanningBrief = { requirement: "", selectedModel: "gpt-5-mini",
    brief: { context: [], actionItems: [], planType: "project", successCriterion: "clarity" } };
  let result: PlanningResult | null = null;
  const fixture = createReviewFixture(project.id, () => draft, { questions: true });
  const control = { reviews: 0, generations: 0, evaluations: [] as unknown[], failReview: options.failReview ?? false };
  await page.route("http://localhost:8000/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/planning-reviews") && request.method() === "POST") {
      control.reviews += 1;
      if (control.failReview) {
        control.failReview = false;
        await route.fulfill({ status: 503, json: { detail: "검토 연결 실패" } }); return;
      }
    }
    if (await fixture.route(route)) return;
    if (path === "/planning/models") {
      await route.fulfill({ json: { defaultModel: "gpt-5-mini", models: [
        { id: "gpt-5-mini", label: "Mini", cost: "low", quality: "standard", speed: "fast", description: "경제적인 생성", recommendedFor: "간단한 계획" },
        { id: "gpt-5.6-sol", label: "Sol", cost: "high", quality: "highest", speed: "deliberate", description: "깊이 있는 생성", recommendedFor: "복잡한 계획" },
      ] } }); return;
    }
    if (path === "/projects") { await route.fulfill({ json: [project] }); return; }
    if (path.endsWith("/planning-brief")) {
      if (request.method() === "PUT") draft = request.postDataJSON();
      await route.fulfill({ json: draft }); return;
    }
    if (/\/planning-confirmations\/[^/]+\/generate$/.test(path)) {
      control.generations += 1;
      const body = fixture.generationBody();
      result = { ...structuredClone(mockPlanningResult), project,
        requirement: { ...mockPlanningResult.requirement!, projectId: project.id, content: body.requirement },
        metadata: { ...mockPlanningResult.metadata, model: body.options.model, resultId: "review-generated",
          reviewId: fixture.reviews[0]!.id } };
      await route.fulfill({ json: fixture.generationResponse(result, request.postDataJSON().idempotencyKey) }); return;
    }
    if (path.endsWith("/planning-results")) {
      await route.fulfill({ json: result ? [{ id: "review-generated", summary: result.summary, model: result.metadata.model,
        createdAt: result.metadata.generatedAt, canRestore: true }] : [] }); return;
    }
    if (path.endsWith("/planning-results/latest")) {
      await route.fulfill({ status: result ? 200 : 404, json: result ?? { detail: "No result" } }); return;
    }
    if (path.endsWith("/quality-evaluations")) {
      if (request.method() === "POST") control.evaluations.push(request.postDataJSON());
      await route.fulfill({ json: request.method() === "POST" ? { id: "quality-test" } : control.evaluations }); return;
    }
    await route.fulfill({ status: 404, json: { detail: "Not found" } });
  });
  return { fixture, control };
}

test("topic review, clarification, model choice, final approval and quality history", async ({ page }, testInfo) => {
  const { control, fixture } = await setup(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByLabel("계획 요구사항", { exact: true }).fill("직원 교육 준비");
  await page.getByLabel("해야 할 일 1", { exact: true }).fill("교육 자료 준비");
  await page.getByRole("button", { name: "AI 입력 검토", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "AI 입력 검토", exact: true });
  const answer = dialog.getByLabel("보완 답변 1", { exact: true });
  await expect(answer).toBeEditable();
  await expect(dialog.getByRole("heading", { name: "추천 모델 Mini", exact: true })).toBeInViewport();
  await expect(dialog.getByRole("heading", { name: "입력 평가와 판단 근거", exact: true })).toBeHidden();
  await expect(dialog.getByText("대상과 일정에 맞는 작업을 정하기 위해 필요합니다.", { exact: true })).toBeHidden();
  await dialog.getByText("질문 이유", { exact: true }).click();
  await expect(dialog.getByText("대상과 일정에 맞는 작업을 정하기 위해 필요합니다.", { exact: true })).toBeVisible();
  await dialog.getByText("질문 이유", { exact: true }).click();
  await dialog.getByText("검토 세부 내용", { exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "입력 평가와 판단 근거", exact: true })).toBeVisible();
  await dialog.getByText("검토 세부 내용", { exact: true }).click();
  await testInfo.attach("input-feedback-desktop", { body: await page.screenshot({ path: "build/local-runtime/input-feedback-desktop.png" }), contentType: "image/png" });
  expect(control.generations).toBe(0);
  await page.reload();
  await page.getByRole("button", { name: "검토 결과 보기", exact: true }).click();
  await expect(answer).toBeEditable();
  await answer.fill("신입 직원 10명, 교육 예정일은 12월 1일입니다.");
  const continueWithAnswers = dialog.getByRole("button", { name: "답변 반영하고 계속", exact: true });
  await expect(continueWithAnswers).toBeEnabled();
  await continueWithAnswers.click();
  await expect(dialog.getByRole("heading", { name: "최종 입력과 생성 모델", exact: true })).toBeVisible();
  expect(control.reviews).toBe(2);
  expect(control.generations).toBe(0);
  expect(fixture.reviews[0]!.parentReviewId).toBe(fixture.reviews[1]!.id);
  expect(fixture.reviews[0]!.input.brief.context[0]).toContain("신입 직원 10명");
  expect(fixture.reviews[0]!.input.brief.actionItems[0]!.title).toBe("교육 자료 준비");
  await expect(dialog.getByRole("heading", { name: "계획에 적용할 가정", exact: true })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "AI가 이해한 목표", exact: true })).toHaveCount(0);
  await expect(dialog.getByText("신입 직원 10명", { exact: false })).toBeVisible();
  await dialog.getByRole("button", { name: "피드백 돌아가기", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "추천 모델 Mini", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "최종 내용 확인", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "확인하고 계획 생성", exact: true })).toBeDisabled();
  await dialog.getByLabel("계획 생성 모델", { exact: true }).selectOption("gpt-5.6-sol");
  await dialog.getByRole("checkbox", { name: "최종 입력과 위 진행 가정을 확인했습니다.", exact: true }).check();
  await testInfo.attach("review-confirmation-desktop", { body: await page.screenshot({ path: "build/local-runtime/review-confirmation-desktop.png" }), contentType: "image/png" });
  await dialog.getByRole("button", { name: "확인하고 계획 생성", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  expect(control.generations).toBe(1);
  expect(fixture.decisions.at(-1)!.selectedModel).toBe("gpt-5.6-sol");
  await page.getByRole("button", { name: "검토·추천 이력", exact: true }).click();
  const history = page.getByRole("dialog", { name: "검토·추천 이력", exact: true });
  await history.getByRole("button", { name: "현재 결과의 생성 검토 보기", exact: true }).click();
  await expect(history.getByText("최종 확인: gpt-5.6-sol · 추천 변경", { exact: true })).toBeVisible();
  await history.getByLabel("품질 의견", { exact: true }).fill("보완한 대상과 일정이 반영됐습니다.");
  await history.getByRole("button", { name: "품질 피드백 저장", exact: true }).click();
  await expect(history.getByText("품질 피드백을 저장했습니다.", { exact: true })).toBeVisible();
  expect(control.evaluations).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("changed input expires feedback and requires a new review", async ({ page }) => {
  const { control } = await setup(page);
  await page.goto("/");
  await page.getByLabel("계획 요구사항", { exact: true }).fill("직원 교육 준비");
  await page.getByRole("button", { name: "AI 입력 검토", exact: true }).click();
  await expect(page.getByRole("heading", { name: "AI가 이해한 목표", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "입력 직접 수정", exact: true }).click();
  await page.getByLabel("계획 요구사항", { exact: true }).fill("개발자 교육 준비");
  await page.getByRole("button", { name: "검토 결과 보기", exact: true }).click();
  await expect(page.getByText("이전 입력의 검토입니다. 현재 입력으로 다시 검토한 뒤 생성할 수 있습니다.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "현재 입력으로 다시 검토", exact: true }).click();
  await expect(page.getByRole("button", { name: "현재 정보로 진행", exact: true })).toBeEnabled();
  expect(control.reviews).toBe(2);
  expect(control.generations).toBe(0);
});

test("review connection failure keeps input and uses explicit execution recovery", async ({ page }) => {
  const { control } = await setup(page, { failReview: true });
  await page.goto("/");
  await page.getByLabel("계획 요구사항", { exact: true }).fill("직원 교육 준비");
  await page.getByRole("button", { name: "AI 입력 검토", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "AI 입력 검토", exact: true });
  await expect(dialog.getByRole("alert")).toContainText("검토 연결 실패");
  expect(control.reviews).toBe(1);
  expect(control.generations).toBe(0);
  await dialog.getByRole("button", { name: "처리 상태 확인", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "AI가 이해한 목표", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("계획 요구사항", { exact: true })).toHaveValue("직원 교육 준비");
});

test("mobile review fits the viewport and records a model choice without generating", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { control, fixture } = await setup(page);
  await page.goto("/");
  await page.getByLabel("계획 요구사항", { exact: true }).fill("직원 교육 준비");
  await page.getByRole("button", { name: "AI 입력 검토", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "AI 입력 검토", exact: true });
  await expect(dialog.getByRole("heading", { name: "보완 질문", exact: true })).toBeInViewport();
  await expect(dialog.getByRole("heading", { name: "추천 모델 Mini", exact: true })).toBeInViewport();
  await expect(dialog.getByRole("button", { name: "현재 정보로 진행", exact: true })).toBeInViewport();
  await testInfo.attach("input-feedback-mobile", { body: await page.screenshot({ path: "build/local-runtime/input-feedback-mobile.png" }), contentType: "image/png" });
  await dialog.getByRole("button", { name: "현재 정보로 진행", exact: true }).click();
  await dialog.getByLabel("계획 생성 모델", { exact: true }).selectOption("gpt-5.6-sol");
  await expect.poll(() => fixture.decisions.length).toBe(1);
  expect(fixture.decisions[0]!.kind).toBe("selection");
  expect(control.generations).toBe(0);
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  await expect(dialog.getByRole("button", { name: "확인하고 계획 생성", exact: true })).toBeInViewport();
  await testInfo.attach("review-confirmation-mobile", { body: await page.screenshot({ path: "build/local-runtime/review-confirmation-mobile.png" }), contentType: "image/png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
