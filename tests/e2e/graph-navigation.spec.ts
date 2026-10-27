import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mockPlanningResult, type PlanningResult } from "@ai-planning-platform/shared";
import { openRoadmapStep } from "./roadmapHelpers";

async function fixture(page: Page, versionFailures = 0) {
  const control = { versionFailures };
  const result = structuredClone(mockPlanningResult);
  result.metadata.resultId = "navigation-current";
  const other = structuredClone(result);
  other.metadata.resultId = "navigation-other";
  other.nodes = other.nodes.map((node) => ({ ...node, position: { x: node.position.x + 2500, y: node.position.y + 1800 } }));
  const brief = { requirement: result.requirement!.content,
    brief: { planType: "project", successCriterion: "clarity", context: ["탐색 확인"], actionItems: [] }, selectedModel: "mock" };
  const writes: string[] = [];
  await page.route("http://localhost:8000/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "POST") writes.push(path);
    let json: unknown;
    if (path === "/planning/models") json = { defaultModel: "mock", models: [{ id: "mock", label: "Mock", cost: "low", speed: "fast", quality: "standard" }] };
    else if (path === "/projects") json = [result.project];
    else if (path.endsWith("/planning-brief")) json = brief;
    else if (path.endsWith("/planning-results")) json = [result, other].map((item) => ({ id: item.metadata.resultId, createdAt: item.metadata.generatedAt, summary: item.summary, model: "mock", canRestore: true }));
    else if (path.endsWith("/latest") || path.endsWith("/navigation-current")) json = result;
    else if (path.endsWith("/navigation-other")) {
      // The comparison panel may also read this version before explicit navigation.
      if (control.versionFailures > 0) { await route.fulfill({ status: 503, json: { detail: "탐색 버전 조회 실패" } }); return; }
      json = other;
    } else { await route.fulfill({ status: 404, json: { detail: "Not found" } }); return; }
    await route.fulfill({ json });
  });
  return { result, other, writes, control };
}

async function viewport(page: Page) {
  return page.locator(".react-flow").evaluate((canvas) => {
    const matrix = new DOMMatrixReadOnly(canvas.querySelector<HTMLElement>(".react-flow__viewport")!.style.transform);
    return { zoom: matrix.a, x: (canvas.clientWidth / 2 - matrix.e) / matrix.a,
      y: (canvas.clientHeight / 2 - matrix.f) / matrix.a };
  });
}

async function expectNodeCentered(page: Page, id: string) {
  await expect(async () => {
    const positions = await page.locator(`.react-flow__node[data-id="${id}"]`).evaluate((node) => {
      const canvas = node.closest(".react-flow")!.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      return { dx: box.x + box.width / 2 - (canvas.x + canvas.width / 2), dy: box.y + box.height / 2 - (canvas.y + canvas.height / 2) };
    });
    expect(Math.abs(positions.dx)).toBeLessThan(2);
    expect(Math.abs(positions.dy)).toBeLessThan(2);
  }).toPass({ timeout: 10_000 });
}

async function openSearch(page: Page) {
  const search = page.locator(".node-search");
  if (await search.getAttribute("open") === null) await search.locator("summary").click();
  await expect(page.getByLabel("노드 이름 검색", { exact: true })).toBeVisible();
  return search;
}

test("graph and roadmap highlight their references and navigation selects and centers the node", async ({ page }, testInfo) => {
  const { writes } = await fixture(page);
  await page.goto("/");
  await page.locator('.react-flow__node[data-id="node-graph-canvas"]').click();
  await expect(page.locator('.roadmap-step[data-related="true"]')).toHaveCount(2);
  await expect(page.getByRole("status", { name: "관련 로드맵 단계" })).toContainText("그래프 캔버스 · 관련 2단계");
  await openRoadmapStep(page, 1);
  await expect(page.locator(".planning-node--related")).toHaveCount(2);
  await expect(page.locator('.react-flow__node[data-id="node-ai-workflow"]')).toHaveAccessibleName(/관련 노드/);
  await testInfo.attach("related-step-nodes", { body: await page.screenshot(), contentType: "image/png" });
  await page.getByRole("button", { name: "관련 노드 그래프 캔버스 위치로 이동", exact: true }).click();
  await expect(page.getByLabel("Node 이름", { exact: true })).toHaveValue("그래프 캔버스");
  await expectNodeCentered(page, "node-graph-canvas");
  await expect(page.locator('.react-flow__node[data-id="node-graph-canvas"]')).toBeFocused();
  await expect(page.locator(".planning-node--related")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "편집 실행 취소", exact: true })).toBeDisabled();
  await expect(page.locator(".workspace__save-state")).toHaveAttribute("aria-label", "결과 편집 저장됨");
  expect(writes).toEqual([]);
  await testInfo.attach("related-node-roadmap", { body: await page.screenshot(), contentType: "image/png" });
});

test("name and type filters intersect, hide incident edges, retain viewport and can be cleared", async ({ page }, testInfo) => {
  const { result, writes } = await fixture(page);
  await page.goto("/");
  await expect(page.locator(".react-flow__node")).toHaveCount(result.nodes.length);
  await page.getByRole("button", { name: "전체 보기", exact: true }).click();
  const originalView = await viewport(page);
  await openSearch(page);
  await page.getByLabel("노드 이름 검색", { exact: true }).fill("  ＡＰＩ  ");
  await page.getByLabel("노드 유형 필터", { exact: true }).selectOption("api");
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.locator(".react-flow__edge")).toHaveCount(0);
  await expect(page.getByRole("status", { name: "노드 검색 결과", exact: true })).toContainText("1 / 6개");
  await page.getByLabel("노드 이름 검색", { exact: true }).fill("");
  await page.getByLabel("노드 유형 필터", { exact: true }).selectOption("ui");
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await testInfo.attach("node-type-filter", { body: await page.screenshot(), contentType: "image/png" });
  await page.getByLabel("노드 이름 검색", { exact: true }).fill("no matching component");
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect(page.getByText("검색 결과가 없습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "전체 보기", exact: true })).toBeDisabled();
  await page.getByLabel("노드 이름 검색", { exact: true }).press("Escape");
  await expect(page.locator(".node-search > summary")).toBeFocused();
  await page.getByRole("status", { name: "노드 필터 상태", exact: true }).getByRole("button", { name: "필터 초기화" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(result.nodes.length);
  await expect(page.locator(".react-flow__edge")).toHaveCount(result.edges.length);
  await expect(async () => {
    const current = await viewport(page);
    expect(current.zoom).toBeCloseTo(originalView.zoom, 5);
    expect(current.x).toBeCloseTo(originalView.x, 0);
    expect(current.y).toBeCloseTo(originalView.y, 0);
  }).toPass({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "편집 실행 취소", exact: true })).toBeDisabled();
  expect(writes).toEqual([]);
});

test("navigation reveals filtered nodes from roadmap focus while preserving unsaved step edits", async ({ page }) => {
  const { writes } = await fixture(page);
  await page.goto("/");
  await openSearch(page);
  await page.getByLabel("노드 이름 검색", { exact: true }).fill("API");
  await page.getByLabel("노드 이름 검색", { exact: true }).press("Escape");
  await page.getByRole("button", { name: "로드맵 집중 보기", exact: true }).click();
  await openRoadmapStep(page, 1);
  await page.getByLabel("1단계 제목", { exact: true }).fill("탐색 후 유지할 단계");
  await page.getByRole("button", { name: "관련 노드 그래프 캔버스 위치로 이동", exact: true }).click();
  await expect(page.getByRole("button", { name: "함께 보기", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status", { name: "노드 필터 상태", exact: true })).toHaveCount(0);
  await expectNodeCentered(page, "node-graph-canvas");
  await openRoadmapStep(page, 1);
  await expect(page.getByLabel("1단계 제목", { exact: true })).toHaveValue("탐색 후 유지할 단계");
  await page.getByRole("button", { name: "편집 실행 취소", exact: true }).click();
  await expect(page.getByLabel("1단계 제목", { exact: true })).toHaveValue(mockPlanningResult.roadmap[0]!.title);
  await expect(page.getByRole("button", { name: "편집 실행 취소", exact: true })).toBeDisabled();
  expect(writes).toEqual([]);
});

test("filters follow renamed and restored nodes while exploration leaves edit history intact", async ({ page }) => {
  const { result, writes } = await fixture(page);
  await page.goto("/");
  await openSearch(page);
  await page.getByLabel("노드 이름 검색", { exact: true }).fill("요구사항 입력");
  await page.getByRole("button", { name: "검색 결과 요구사항 입력 위치로 이동", exact: true }).click();
  await expectNodeCentered(page, "node-requirement-input");
  await page.getByLabel("Node 이름", { exact: true }).fill("변경한 노드 이름");
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect(page.getByLabel("Node 이름", { exact: true })).toHaveValue("변경한 노드 이름");
  await page.getByRole("button", { name: "편집 실행 취소", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.getByRole("button", { name: "편집 다시 실행", exact: true }).click();
  await page.getByRole("button", { name: "선택한 노드 표시", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(result.nodes.length);
  await expectNodeCentered(page, "node-requirement-input");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "노드 삭제", exact: true }).click();
  await expect(page.locator('.roadmap-step[data-related="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: "편집 실행 취소", exact: true }).click();
  await expect(page.locator('.roadmap-step[data-related="true"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "2단계 관련 노드 변경한 노드 이름 위치로 이동", exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});

test("failed version lookup retains filters and successful version change clears them without reusing an old focus target", async ({ page }) => {
  const { control } = await fixture(page, 1);
  await page.goto("/");
  await openSearch(page);
  await page.getByLabel("노드 이름 검색", { exact: true }).fill("API");
  await page.getByRole("button", { name: "검색 결과 계획 API 위치로 이동", exact: true }).click();
  await expectNodeCentered(page, "node-planning-api");
  await page.getByLabel("계획 버전", { exact: true }).selectOption("navigation-other");
  const failure = page.getByRole("alert", { name: "버전 조회 실패", exact: true });
  await expect(failure).toBeVisible();
  await expect(page.getByRole("status", { name: "노드 필터 상태", exact: true })).toBeVisible();
  control.versionFailures = 0;
  await failure.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByRole("status", { name: "노드 필터 상태", exact: true })).toHaveCount(0);
  await expect(page.locator(".react-flow__node")).toHaveCount(mockPlanningResult.nodes.length);
  await expect(page.getByRole("button", { name: "편집 실행 취소", exact: true })).toBeDisabled();
  await expect.poll(async () => (await viewport(page)).x).toBeGreaterThan(2500);
  await expect(page.locator(".node-search")).not.toHaveAttribute("open", "");
});

test("saving and exporting a filtered graph include hidden nodes and preserve the filter", async ({ page }) => {
  const { result, other } = await fixture(page);
  let saved: PlanningResult | null = null;
  await page.route("http://localhost:8000/**/edit", async (route) => {
    const payload = route.request().postDataJSON();
    expect(payload.nodes).toHaveLength(result.nodes.length);
    expect(payload.edges).toEqual(result.edges);
    expect(payload.roadmap).toEqual(result.roadmap);
    saved = { ...result, nodes: payload.nodes, edges: payload.edges, roadmap: payload.roadmap,
      metadata: { ...result.metadata, resultId: "navigation-saved", editedFromResultId: result.metadata.resultId } };
    await route.fulfill({ json: saved });
  });
  await page.route("http://localhost:8000/**/planning-results", async (route) => {
    await route.fulfill({ json: (saved ? [saved, result, other] : [result, other]).map((item) => ({ id: item.metadata.resultId,
      createdAt: item.metadata.generatedAt, summary: item.summary, model: "mock", canRestore: true })) });
  });
  await page.goto("/");
  await openSearch(page);
  await page.getByLabel("노드 이름 검색", { exact: true }).fill("API");
  await page.getByRole("button", { name: "검색 결과 계획 API 위치로 이동", exact: true }).click();
  await page.getByLabel("Node 우선순위", { exact: true }).selectOption("low");
  await page.locator(".graph-edit-panel").getByRole("button", { name: "변경 내용을 새 버전으로 저장", exact: true }).click();
  await expect(page.getByLabel("계획 버전", { exact: true })).toHaveValue("navigation-saved");
  await expect(page.locator(".workspace__save-state")).toHaveAttribute("aria-label", "결과 편집 저장됨");
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.getByRole("status", { name: "노드 필터 상태", exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Markdown 내보내기", exact: true }).click();
  const download = await downloadEvent;
  const markdown = await readFile((await download.path())!, "utf8");
  for (const node of result.nodes) expect(markdown).toContain(node.label);
  for (const step of result.roadmap) expect(markdown).toContain(step.title);
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.getByRole("button", { name: "편집 실행 취소", exact: true }).click();
  await expect(page.getByLabel("Node 우선순위", { exact: true })).toHaveValue("high");
  await expect(page.locator(".workspace__save-state")).toHaveAttribute("aria-label", "결과 편집 미저장");
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
});

test("search and roadmap navigation remain usable on mobile and compact desktop", async ({ page }, testInfo) => {
  await fixture(page);
  for (const size of [{ width: 390, height: 844 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(size);
    await page.goto("/");
    const collapse = page.getByRole("button", { name: "계획 입력 접기", exact: true });
    if (await collapse.isVisible()) await collapse.click();
    await page.getByRole("button", { name: "그래프 집중 보기", exact: true }).click();
    await openSearch(page);
    await page.getByLabel("노드 이름 검색", { exact: true }).fill("API");
    const panel = await page.locator(".node-search .workspace-popover__content").boundingBox();
    expect(panel!.x).toBeGreaterThanOrEqual(0);
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(size.width);
    await testInfo.attach(`node-search-${size.width}`, { body: await page.screenshot(), contentType: "image/png" });
    const choice = page.getByRole("button", { name: "검색 결과 계획 API 위치로 이동", exact: true });
    await choice.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Node 이름", { exact: true })).toHaveValue("계획 API");
    await page.getByRole("button", { name: "Node 편집 닫기", exact: true }).click();
    await expectNodeCentered(page, "node-planning-api");
    await page.getByRole("button", { name: "로드맵 집중 보기", exact: true }).click();
    await page.getByRole("button", { name: "1단계 관련 노드 그래프 캔버스 위치로 이동", exact: true }).click();
    await expect(page.getByLabel("Node 이름", { exact: true })).toHaveValue("그래프 캔버스");
    await page.getByRole("button", { name: "Node 편집 닫기", exact: true }).click();
    await expectNodeCentered(page, "node-graph-canvas");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    await testInfo.attach(`node-navigation-${size.width}`, { body: await page.screenshot(), contentType: "image/png" });
  }
});
