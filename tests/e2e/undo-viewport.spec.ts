import { expect, test, type Page } from "@playwright/test";
import { mockPlanningResult } from "@ai-planning-platform/shared";
import { openRoadmapStep } from "./roadmapHelpers";

test.beforeEach(async ({ page }) => {
  const project = mockPlanningResult.project!;
  const result = structuredClone(mockPlanningResult);
  result.metadata.resultId = "undo-original";
  const other = structuredClone(result);
  other.metadata.resultId = "undo-other";
  other.nodes = other.nodes.map((node) => ({ ...node, position: { x: node.position.x + 3000, y: node.position.y + 2000 } }));
  const brief = { requirement: result.requirement!.content,
    brief: { planType: "project", successCriterion: "clarity", context: [], actionItems: [] }, selectedModel: "mock" };
  await page.route("http://localhost:8000/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/planning-reviews")) { await route.fulfill({ json: [] }); return; }
    let json: unknown;
    if (path === "/planning/models") json = { defaultModel: "mock", models: [{ id: "mock", label: "Mock", cost: "low", speed: "fast", quality: "standard" }] };
    else if (path === "/projects") json = [project];
    else if (path.endsWith("/planning-brief")) json = brief;
    else if (path.endsWith("/planning-results")) json = [result, other].map((item) => ({ id: item.metadata.resultId, createdAt: item.metadata.generatedAt, summary: item.summary, model: "mock", canRestore: true }));
    else if (path.endsWith("/latest") || path.endsWith("/undo-original")) json = result;
    else if (path.endsWith("/undo-other")) json = other;
    else { await route.fulfill({ status: 404, json: { detail: "Not found" } }); return; }
    await route.fulfill({ json });
  });
});

async function view(page: Page) {
  return page.locator(".react-flow").evaluate((canvas) => {
    const matrix = new DOMMatrixReadOnly((canvas.querySelector<HTMLElement>(".react-flow__viewport")!).style.transform);
    return { zoom: matrix.a, x: (canvas.clientWidth / 2 - matrix.e) / matrix.a,
      y: (canvas.clientHeight / 2 - matrix.f) / matrix.a };
  });
}

test("undo/redo groups typing, shares graph and roadmap history, and respects native text undo", async ({ page }, testInfo) => {
  await page.goto("/");
  const undo = page.getByRole("button", { name: "편집 실행 취소", exact: true });
  const redo = page.getByRole("button", { name: "편집 다시 실행", exact: true });
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  const count = mockPlanningResult.nodes.length;
  await page.getByRole("button", { name: "노드 추가", exact: true }).click();
  const name = page.getByLabel("Node 이름", { exact: true });
  await name.fill("");
  await name.pressSequentially("New component");
  // The input owns Ctrl+Z: it must not undo the node addition or close the editor.
  await name.press("Control+z");
  await expect(name).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(count + 1);
  await name.fill("Grouped node name");
  await undo.click();
  await expect(name).toHaveValue("새 노드");
  await redo.focus();
  await page.keyboard.press("Control+Shift+z");
  await expect(name).toHaveValue("Grouped node name");
  await openRoadmapStep(page, 1);
  const originalTitle = mockPlanningResult.roadmap.find((step) => step.order === 1)!.title;
  await page.getByLabel("1단계 제목", { exact: true }).fill("Edited roadmap title");
  await undo.click();
  await expect(page.getByLabel("1단계 제목", { exact: true })).toHaveValue(originalTitle);
  await undo.focus();
  await page.keyboard.press("Control+z");
  await expect(name).toHaveValue("새 노드");
  await page.keyboard.press("Control+z");
  await expect(page.locator(".react-flow__node")).toHaveCount(count);
  await expect(page.locator(".workspace__save-state")).toHaveAttribute("aria-label", "결과 편집 저장됨");
  await expect(undo).toBeDisabled();
  await redo.click();
  await expect(page.locator(".react-flow__node")).toHaveCount(count + 1);
  await page.getByLabel("Node 우선순위", { exact: true }).selectOption("high");
  await expect(redo).toBeDisabled();
  await testInfo.attach("undo-redo-desktop", { body: await page.screenshot(), contentType: "image/png" });
});

test("canvas keeps zoom and world center through edits, panel resize and focus views", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.getByRole("button", { name: "전체 보기", exact: true }).click();
  const initial = await view(page);
  await page.locator(".react-flow__controls-zoomin").click();
  await expect.poll(async () => (await view(page)).zoom).toBeGreaterThan(initial.zoom);
  const pane = page.locator(".react-flow__pane");
  const box = (await pane.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 75, box.y + 50, { steps: 5 });
  await page.mouse.up();
  const before = await view(page);
  async function expectViewPreserved() {
    await expect(async () => {
      const after = await view(page);
      expect(after.zoom).toBeCloseTo(before.zoom, 5);
      expect(after.x).toBeCloseTo(before.x, 0);
      expect(after.y).toBeCloseTo(before.y, 0);
    }).toPass();
  }
  await openRoadmapStep(page, 1);
  await expectViewPreserved();
  await page.getByRole("button", { name: "노드 추가", exact: true }).click();
  await expectViewPreserved();
  await page.getByRole("button", { name: "편집 실행 취소", exact: true }).click();
  await expectViewPreserved();
  const resize = page.getByRole("separator", { name: "입력 패널 너비 조절", exact: true });
  await resize.focus();
  await page.keyboard.press("End");
  await expectViewPreserved();
  await page.getByRole("button", { name: "그래프 집중 보기", exact: true }).click();
  await expectViewPreserved();
  await page.getByRole("button", { name: "로드맵 집중 보기", exact: true }).click();
  await page.getByRole("button", { name: "계획 입력 접기", exact: true }).click();
  await page.getByRole("button", { name: "함께 보기", exact: true }).click();
  await expectViewPreserved();
  await page.getByRole("button", { name: "전체 보기", exact: true }).click();
  await expect.poll(async () => (await view(page)).zoom).not.toBe(before.zoom);
});

test("new result with the same node count fits once and starts a fresh local history", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.getByRole("button", { name: "전체 보기", exact: true }).click();
  const before = await view(page);
  await page.locator(".react-flow__node").first().click();
  await page.getByLabel("Node 이름", { exact: true }).fill("Unsaved edit");
  await page.getByRole("button", { name: "로드맵 집중 보기", exact: true }).click();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByLabel("계획 버전", { exact: true }).selectOption("undo-other");
  await expect(page.locator(".react-flow__node")).toHaveCount(mockPlanningResult.nodes.length);
  await expect(page.getByRole("button", { name: "편집 실행 취소", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "함께 보기", exact: true }).click();
  await testInfo.attach("new-version-position", { body: JSON.stringify({ before, after: await view(page),
    positions: await page.locator(".react-flow__node").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).style.transform)) }), contentType: "application/json" });
  await expect(async () => {
    const after = await view(page);
    expect(after.x - before.x).toBeCloseTo(3000, -1);
    expect(after.y - before.y).toBeCloseTo(2000, -1);
  }).toPass({ timeout: 10_000 });
  await page.getByLabel("계획 버전", { exact: true }).selectOption("undo-original");
  await expect(async () => {
    const after = await view(page);
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.y).toBeCloseTo(before.y, 0);
  }).toPass({ timeout: 10_000 });
});

test("mobile provides undo and redo without horizontal overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "계획 입력 접기", exact: true }).click();
  await openRoadmapStep(page, 1);
  await page.getByLabel("1단계 제목", { exact: true }).fill("Mobile edit");
  await page.getByRole("button", { name: "단계 편집 닫기", exact: true }).click();
  await page.getByRole("button", { name: "편집 실행 취소", exact: true }).click();
  await expect(page.getByRole("button", { name: "1단계 Mobile edit 편집", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "편집 다시 실행", exact: true }).click();
  await expect(page.getByRole("button", { name: "1단계 Mobile edit 편집", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await testInfo.attach("undo-redo-mobile", { body: await page.screenshot(), contentType: "image/png" });
});

test("keyboard node movement participates in undo history", async ({ page }) => {
  await page.goto("/");
  const node = page.locator(".react-flow__node").first();
  await node.click();
  const originalPosition = await node.evaluate((element) => (element as HTMLElement).style.transform);
  await node.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => node.evaluate((element) => (element as HTMLElement).style.transform)).not.toBe(originalPosition);
  await expect(page.locator(".workspace__save-state")).toHaveAttribute("aria-label", "결과 편집 미저장");
  await page.getByRole("button", { name: "편집 실행 취소", exact: true }).click();
  await expect.poll(() => node.evaluate((element) => (element as HTMLElement).style.transform)).toBe(originalPosition);
  await expect(page.locator(".workspace__save-state")).toHaveAttribute("aria-label", "결과 편집 저장됨");
});
