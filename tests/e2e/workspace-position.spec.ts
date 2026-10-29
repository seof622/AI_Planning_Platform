import { expect, test, type Page } from "@playwright/test";
import { mockPlanningResult } from "@ai-planning-platform/shared";
import { openRoadmapStep } from "./roadmapHelpers";

const prefix = "plannote.workspace-position.v1:";
const lastKey = "plannote.last-project.v1";
async function fixture(page: Page) {
  const results = ["position-a", "position-b"].map((id) => {
    const result = structuredClone(mockPlanningResult);
    result.project = { ...result.project!, id, title: id };
    result.metadata.resultId = `${id}-v1`;
    result.roadmap = Array.from({ length: 10 }, (_, i) => ({ ...result.roadmap[i % result.roadmap.length]!,
      id: `step-${i + 1}`, order: i + 1, title: `Step ${i + 1}`, dependsOn: [] }));
    return result;
  });
  const controls = { failB: false, writes: [] as string[] };
  await page.route("http://localhost:8000/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") controls.writes.push(path);
    if (controls.failB && path.includes("/position-b/")) {
      await route.fulfill({ status: 503, json: { detail: "Project unavailable" } }); return;
    }
    const result = results.find((item) => path.includes(`/${item.project!.id}/`)) ?? results[0]!;
    let json: unknown;
    if (path === "/planning/models") json = { defaultModel: "mock", models: [{ id: "mock", label: "Mock", cost: "low", speed: "fast", quality: "standard" }] };
    else if (path === "/projects") json = results.map((item) => item.project);
    else if (path.endsWith("/planning-brief")) json = { requirement: result.requirement!.content,
      brief: { planType: "project", successCriterion: "clarity", context: [], actionItems: [] }, selectedModel: "mock" };
    else if (path.endsWith("/planning-results")) json = [{ id: result.metadata.resultId, createdAt: result.metadata.generatedAt, summary: result.summary, model: "mock", canRestore: true }];
    else if (path.endsWith("/latest")) json = result;
    else { await route.fulfill({ status: 404, json: { detail: "Not found" } }); return; }
    await route.fulfill({ json });
  });
  return { results, controls };
}
const projectSelect = (page: Page) => page.getByLabel("프로젝트", { exact: true });
async function ready(page: Page, id: string) {
  await expect(projectSelect(page)).toHaveValue(id);
  await expect(projectSelect(page)).toBeEnabled();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
}
async function view(page: Page) {
  return page.locator(".react-flow").evaluate((canvas) => {
    const matrix = new DOMMatrixReadOnly(canvas.querySelector<HTMLElement>(".react-flow__viewport")!.style.transform);
    return { zoom: matrix.a, x: (canvas.clientWidth / 2 - matrix.e) / matrix.a, y: (canvas.clientHeight / 2 - matrix.f) / matrix.a };
  });
}
async function stored(page: Page, id: string) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), prefix + id);
}
async function sameView(page: Page, expected: Awaited<ReturnType<typeof view>>) {
  await expect(async () => {
    const actual = await view(page);
    expect(actual.zoom).toBeCloseTo(expected.zoom, 4);
    expect(actual.x).toBeCloseTo(expected.x, 0);
    expect(actual.y).toBeCloseTo(expected.y, 0);
  }).toPass({ timeout: 10_000 });
}

async function expectStoredView(page: Page, id: string) {
  await expect(async () => {
    const saved = (await stored(page, id))?.viewport;
    expect(saved).toBeTruthy();
    const actual = await view(page);
    expect(saved.zoom).toBeCloseTo(actual.zoom, 4);
    expect(saved.x).toBeCloseTo(actual.x, 0);
    expect(saved.y).toBeCloseTo(actual.y, 0);
  }).toPass({ timeout: 10_000 });
}

test("restores project-specific node, canvas and roadmap positions after switching and reload", async ({ page }, testInfo) => {
  const { controls } = await fixture(page);
  await page.goto("/");
  await ready(page, "position-a");
  const node = page.locator('.react-flow__node[data-id="node-graph-canvas"]');
  await node.click();
  await page.locator(".react-flow__controls-zoomin").click();
  const point = await page.locator(".react-flow__pane").evaluate((pane) => {
    const box = pane.getBoundingClientRect();
    for (let y = box.top + 20; y < box.bottom - 70; y += 30) {
      for (let x = box.left + 20; x < box.right - 100; x += 30) {
        if (document.elementFromPoint(x, y) === pane) return { x, y };
      }
    }
    throw new Error("No empty canvas area to pan");
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 70, point.y + 40, { steps: 5 });
  await page.mouse.up();
  // Pane clicks deselect; select again before capturing the final center.
  await node.click();
  await expect.poll(async () => (await stored(page, "position-a"))?.selectedNodeId).toBe("node-graph-canvas");
  await expectStoredView(page, "position-a");
  const aView = await view(page);
  await page.locator(".roadmap__steps").evaluate((list) => { list.scrollLeft = 620; });
  await expect.poll(async () => (await stored(page, "position-a"))?.roadmapScrollLeft).toBe(620);
  await expect(page.locator(".workspace__save-state")).toHaveAttribute("aria-label", "결과 편집 저장됨");
  await projectSelect(page).selectOption("position-b");
  await ready(page, "position-b");
  await openRoadmapStep(page, 7);
  await page.locator(".roadmap__steps").evaluate((list) => { list.scrollLeft = 1000; });
  await expect.poll(async () => (await stored(page, "position-b"))?.roadmapScrollLeft).toBe(1000);
  await page.reload();
  await ready(page, "position-b");
  await expect(page.getByLabel("7단계 제목", { exact: true })).toHaveValue("Step 7");
  await expect.poll(() => page.locator(".roadmap__steps").evaluate((list) => list.scrollLeft)).toBe(1000);
  await projectSelect(page).selectOption("position-a");
  await ready(page, "position-a");
  await expect(page.getByLabel("Node 이름", { exact: true })).toHaveValue("그래프 캔버스");
  await sameView(page, aView);
  await expect.poll(() => page.locator(".roadmap__steps").evaluate((list) => list.scrollLeft)).toBe(620);
  await page.reload();
  await ready(page, "position-a");
  await sameView(page, aView);
  await expect(page.getByRole("button", { name: "편집 실행 취소", exact: true })).toBeDisabled();
  await expect(page.locator(".workspace__save-state")).toHaveAttribute("aria-label", "결과 편집 저장됨");
  expect(controls.writes).toEqual([]);
  await testInfo.attach("restored-project-position", { body: await page.screenshot(), contentType: "image/png" });
});

test("keeps a hidden canvas position through reload and restores when revealed", async ({ page }) => {
  await fixture(page);
  await page.goto("/");
  await ready(page, "position-a");
  await page.locator(".react-flow__controls-zoomin").click();
  await expectStoredView(page, "position-a");
  const before = await view(page);
  await page.getByRole("button", { name: "로드맵 집중 보기", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("plannote.workspace-layout.v1") ?? "null")?.view)).toBe("roadmap");
  await page.reload();
  await expect(projectSelect(page)).toBeEnabled();
  await expect(page.locator("#planning-canvas")).toBeHidden();
  await page.getByRole("button", { name: "함께 보기", exact: true }).click();
  await sameView(page, before);
});

test("falls back from missing projects and drops deleted selections when the latest result changes", async ({ page }) => {
  const { results } = await fixture(page);
  await page.addInitScript(({ key, prefix }) => {
    localStorage.setItem(key, "deleted-project");
    localStorage.setItem(prefix + "position-a", "broken JSON");
  }, { key: lastKey, prefix });
  await page.goto("/");
  await ready(page, "position-a");
  const nodeId = "node-graph-canvas";
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
  await projectSelect(page).selectOption("position-b");
  await ready(page, "position-b");
  const a = results[0]!;
  a.metadata.resultId = "position-a-v2";
  a.nodes = a.nodes.filter((node) => node.id !== nodeId).map((node) => ({ ...node, position: { x: node.position.x + 3000, y: node.position.y + 2000 } }));
  a.edges = a.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
  a.roadmap = a.roadmap.map((step) => ({ ...step, componentNodeIds: step.componentNodeIds?.filter((id) => id !== nodeId) }));
  await projectSelect(page).selectOption("position-a");
  await ready(page, "position-a");
  await expect(page.getByLabel("Node 이름", { exact: true })).toHaveCount(0);
  await expect.poll(async () => (await view(page)).x).toBeGreaterThan(2500);
  expect((await stored(page, "position-a")).selectedNodeId).toBeNull();
});

test("failed project loads preserve the last successful project and its saved position", async ({ page }) => {
  const { controls } = await fixture(page);
  await page.goto("/");
  await ready(page, "position-a");
  await page.locator('.react-flow__node[data-id="node-graph-canvas"]').click();
  await expect.poll(async () => (await stored(page, "position-a"))?.selectedNodeId).toBe("node-graph-canvas");
  const before = await stored(page, "position-a");
  controls.failB = true;
  await projectSelect(page).selectOption("position-b");
  await expect(page.getByRole("alert", { name: "프로젝트 조회 실패", exact: true })).toBeVisible();
  expect(await stored(page, "position-a")).toEqual(before);
  expect(await page.evaluate((key) => localStorage.getItem(key), lastKey)).toBe("position-a");
  controls.failB = false;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await ready(page, "position-b");
  await projectSelect(page).selectOption("position-a");
  await ready(page, "position-a");
  await expect(page.getByLabel("Node 이름", { exact: true })).toHaveValue("그래프 캔버스");
});

test("navigation remains usable when browser storage is blocked", async ({ page }) => {
  await fixture(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error("Storage unavailable"); };
    Storage.prototype.setItem = () => { throw new Error("Storage unavailable"); };
  });
  await page.goto("/");
  await ready(page, "position-a");
  await projectSelect(page).selectOption("position-b");
  await ready(page, "position-b");
  await openRoadmapStep(page, 2);
  await page.locator(".react-flow__controls-zoomin").click();
  expect(errors).toEqual([]);
});
