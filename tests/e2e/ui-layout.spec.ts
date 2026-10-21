import { expect, test } from "@playwright/test";
import { mockPlanningResult } from "@ai-planning-platform/shared";

// Layout checks use a fixture so they do not create or modify personal projects.
test.beforeEach(async ({ page }) => {
  const project = { ...mockPlanningResult.project!, title: "나만의 계획 서비스" };
  const result = { ...mockPlanningResult, project, metadata: { ...mockPlanningResult.metadata, resultId: "layout-result" } };
  const brief = { requirement: mockPlanningResult.requirement!.content,
    brief: { planType: "project", successCriterion: "clarity", context: ["개인 프로젝트"], actionItems: [] }, selectedModel: "mock" };
  await page.route("http://localhost:8000/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown;
    if (path === "/planning/models") json = { defaultModel: "mock", models: [{ id: "mock", label: "기본 계획 모델", description: "간결하고 실행 가능한 계획", recommendedFor: "개인 프로젝트", cost: "low", speed: "fast", quality: "standard" }] };
    else if (path === "/projects") json = [project];
    else if (path.endsWith("/planning-brief")) json = brief;
    else if (path.endsWith("/planning-results")) json = [{ id: "layout-result", createdAt: result.metadata.generatedAt, summary: result.summary, model: "mock", canRestore: true }];
    else if (path.endsWith("/latest")) json = result;
    else { await route.fulfill({ status: 404, json: { detail: "Not found" } }); return; }
    await route.fulfill({ json });
  });
});

test("desktop workspace fits the viewport and keeps canvas, roadmap and inspector separate", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await expect(page.locator(".workspace__header").getByLabel("프로젝트", { exact: true })).toBeVisible();
  await expect(page.locator(".workspace__toolbar").getByLabel("계획 버전", { exact: true })).toBeVisible();
  await expect(page.locator(".workspace__toolbar").getByRole("button", { name: "Markdown 내보내기" })).toBeVisible();
  await expect(page.locator(".canvas-shell").getByRole("button", { name: "노드 추가", exact: true })).toBeVisible();
  await expect(page.locator(".workspace__sidebar > *")).toHaveCount(1);
  await expect(page.locator(".workspace__sidebar").getByRole("heading", { name: "계획 입력" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('14px "Pretendard"', "계획"))).toBe(true);
  const bounds = await page.evaluate(() => {
    const graph = document.querySelector(".canvas-shell")!.getBoundingClientRect();
    const roadmap = document.querySelector(".roadmap")!.getBoundingClientRect();
    return { graphBottom: graph.bottom, roadmapTop: roadmap.top, pageHeight: document.documentElement.scrollHeight, pageWidth: document.documentElement.scrollWidth };
  });
  expect(bounds.graphBottom).toBeLessThan(bounds.roadmapTop);
  expect(bounds.pageHeight).toBeLessThanOrEqual(960);
  expect(bounds.pageWidth).toBeLessThanOrEqual(1440);
  await page.getByRole("button", { name: "미니맵 표시", exact: true }).click();
  await expect(page.locator(".react-flow__minimap")).toBeVisible();
  await page.getByRole("button", { name: "미니맵 숨기기", exact: true }).click();
  await expect(page.locator(".react-flow__minimap")).toHaveCount(0);
  await testInfo.attach("workspace-desktop", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await page.locator(".react-flow__node").first().click();
  await expect(page.getByLabel("Node 이름", { exact: true })).toBeVisible();
  const inspectorBounds = await page.evaluate(() => {
    const graph = document.querySelector(".canvas-shell")!.getBoundingClientRect();
    const inspector = document.querySelector(".detail-drawer--open")!.getBoundingClientRect();
    return { graphRight: graph.right, inspectorLeft: inspector.left, inspectorRight: inspector.right };
  });
  expect(inspectorBounds.graphRight).toBeLessThan(inspectorBounds.inspectorLeft);
  expect(inspectorBounds.inspectorRight).toBeLessThanOrEqual(1440);
  // All nodes stay within the resized canvas instead of disappearing behind the inspector.
  await expect(async () => {
    const fits = await page.locator(".canvas-shell").evaluate((canvas) => {
      const area = canvas.getBoundingClientRect();
      return [...canvas.querySelectorAll(".react-flow__node")].every((node) => {
        const box = node.getBoundingClientRect();
        return box.left >= area.left && box.right <= area.right;
      });
    });
    expect(fits).toBe(true);
  }).toPass();

  // Project creation and version details are available on demand, with keyboard dismissal.
  await page.locator(".project-panel__new > summary").click();
  await page.getByLabel("새 프로젝트 이름").fill("프로젝트 이름 초안");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("새 프로젝트 이름")).toBeHidden();
  await expect(page.locator(".project-panel__new > summary")).toBeFocused();
  await page.locator(".project-panel__new > summary").click();
  await expect(page.getByLabel("새 프로젝트 이름")).toHaveValue("프로젝트 이름 초안");
  await page.getByRole("button", { name: "새 프로젝트 닫기", exact: true }).click();
  await page.locator(".history-panel__details > summary").click();
  await expect(page.locator(".history-panel__origin")).toBeVisible();
  await page.locator(".workspace__brand").click();
  await expect(page.locator(".history-panel__origin")).toBeHidden();

  // Advanced fields retain edits while the model and generation controls stay in place.
  await page.locator(".brief-options > summary").click();
  await page.getByLabel("제약 조건", { exact: true }).fill("주말에만 진행");
  await page.locator(".brief-options > summary").click();
  await expect(page.locator(".brief-options > summary")).toContainText("제약 있음");
  await page.locator(".brief-options > summary").click();
  await expect(page.getByLabel("제약 조건", { exact: true })).toHaveValue("주말에만 진행");
  const generate = page.getByRole("button", { name: "계획 생성", exact: true });
  const beforeScroll = await generate.boundingBox();
  await page.locator(".requirement-form__body").evaluate((body) => { body.scrollTop = body.scrollHeight; });
  expect(await generate.boundingBox()).toEqual(beforeScroll);
  await page.locator(".model-details > summary").click();
  await expect(generate).toBeInViewport();
  expect(await generate.boundingBox()).toEqual(beforeScroll);
});

test("mobile workspace has no horizontal overflow and keeps editor controls usable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "노드 추가", exact: true })).toBeEnabled();
  await page.locator(".project-panel__new > summary").click();
  const createBounds = await page.locator(".project-panel__new .workspace-popover__content").boundingBox();
  expect(createBounds!.x).toBeGreaterThanOrEqual(0);
  expect(createBounds!.x + createBounds!.width).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "새 프로젝트 닫기", exact: true }).click();
  await page.locator(".history-panel__details > summary").click();
  const historyBounds = await page.locator(".history-panel__details .workspace-popover__content").boundingBox();
  expect(historyBounds!.x).toBeGreaterThanOrEqual(0);
  expect(historyBounds!.x + historyBounds!.width).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "버전 정보·비교 닫기", exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator(".react-flow__node").first().click();
  await expect(page.getByLabel("Node 이름", { exact: true })).toBeVisible();
  const inspector = await page.locator(".detail-drawer--open").boundingBox();
  expect(inspector!.x).toBeGreaterThanOrEqual(0);
  expect(inspector!.x + inspector!.width).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Node 편집 닫기", exact: true }).click();
  await expect(page.getByRole("button", { name: "단계 추가", exact: true })).toBeEnabled();
  await testInfo.attach("workspace-mobile", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});

test("compact desktop keeps the toolbar and generation action inside the workspace", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  const bounds = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
  expect(bounds.width).toBeLessThanOrEqual(1024);
  expect(bounds.height).toBeLessThanOrEqual(768);
  const generate = await page.getByRole("button", { name: "계획 생성", exact: true }).boundingBox();
  expect(generate!.y + generate!.height).toBeLessThanOrEqual(768);
  const toolbar = page.locator(".graph-edit-panel");
  await expect(toolbar.getByRole("button", { name: "그래프 새 버전 저장", exact: true })).toBeVisible();
  await toolbar.locator(".graph-edit-panel__help > summary").click();
  await expect(page.getByRole("button", { name: "연결 도움말 닫기", exact: true })).toBeInViewport();
  await page.getByRole("button", { name: "연결 도움말 닫기", exact: true }).click();
  await testInfo.attach("workspace-compact-desktop", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});
