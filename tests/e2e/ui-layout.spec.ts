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
});

test("mobile workspace has no horizontal overflow and keeps editor controls usable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "노드 추가", exact: true })).toBeEnabled();
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
