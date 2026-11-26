import { expect, test, type Page } from "@playwright/test";
import { mockPlanningResult } from "@ai-planning-platform/shared";

const longDescription = Array.from({ length: 18 }, (_, index) =>
  `${index + 1}. 요구사항의 목적과 실행 방법을 확인합니다. 긴 설명도 원래 줄바꿈을 유지하고 끝까지 읽을 수 있어야 합니다.`).join("\n\n");

async function fixture(page: Page) {
  const result = structuredClone(mockPlanningResult);
  result.metadata.resultId = "reading-current";
  result.nodes[0]!.description = longDescription;
  result.nodes[1]!.description = "짧은 설명";
  result.roadmap = Array.from({ length: 10 }, (_, index) => ({ ...result.roadmap[0]!,
    id: `reading-step-${index + 1}`, order: index + 1, title: `실행 단계 ${index + 1}`,
    description: `${index + 1}단계 전문\n\n${longDescription}`, dependsOn: [] }));
  const other = structuredClone(result);
  other.metadata.resultId = "reading-old";
  other.nodes[0]!.description = "과거 버전의 설명";
  const writes: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("http://localhost:8000/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/planning-reviews")) { await route.fulfill({ json: [] }); return; }
    if (route.request().method() !== "GET") writes.push(path);
    let json: unknown;
    if (path === "/planning/models") json = { defaultModel: "mock", models: [{ id: "mock", label: "Mock", cost: "low", speed: "fast", quality: "standard" }] };
    else if (path === "/projects") json = [result.project];
    else if (path.endsWith("/planning-brief")) json = { requirement: result.requirement!.content,
      brief: { planType: "project", successCriterion: "clarity", context: [], actionItems: [] }, selectedModel: "mock" };
    else if (path.endsWith("/planning-results")) json = [result, other].map((item) => ({ id: item.metadata.resultId,
      createdAt: item.metadata.generatedAt, summary: item.summary, model: "mock", canRestore: true }));
    else if (path.endsWith("/latest") || path.endsWith("/reading-current")) json = result;
    else if (path.endsWith("/reading-old")) json = other;
    else { await route.fulfill({ status: 404, json: { detail: "Not found" } }); return; }
    await route.fulfill({ json });
  });
  await page.goto("/");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return { result, writes, errors };
}

async function viewport(page: Page) {
  return page.locator(".react-flow__viewport").evaluate((element) => element.getAttribute("style"));
}

async function inBounds(page: Page) {
  const box = await page.getByRole("dialog").boundingBox();
  const size = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
}

test("node full reading opens directly in a large modal and preserves selection, viewport and saved state", async ({ page }, testInfo) => {
  const { result, writes, errors } = await fixture(page);
  const node = page.locator(`.react-flow__node[data-id="${result.nodes[0]!.id}"]`);
  const trigger = node;
  await expect(page.getByRole("button", { name: /전체 읽기$/ })).toHaveCount(0);
  const before = await viewport(page);
  const coordinates = await node.getAttribute("style");
  const options = await page.getByLabel("계획 버전", { exact: true }).locator("option").count();
  await expect(page.getByRole("status", { name: "결과 편집 저장됨", exact: true })).toBeVisible();
  await trigger.dblclick();
  const reader = page.getByRole("dialog", { name: result.nodes[0]!.label });
  await expect(reader).toBeVisible();
  await expect(reader).toHaveAttribute("aria-modal", "true");
  await expect(reader).toHaveAttribute("data-expanded", "true");
  const box = (await reader.boundingBox())!;
  expect(box.width).toBe(760);
  expect(Math.abs(box.x + box.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(1);
  await expect(page.locator("#workspace-detail")).toHaveCount(0);
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(0);
  expect(await viewport(page)).toBe(before);
  expect(await node.getAttribute("style")).toBe(coordinates);
  await expect(reader.locator(".content-reader__description")).toHaveText(longDescription);
  expect(await reader.locator(".content-reader__description").evaluate((element) => {
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.toString();
  })).toBe(longDescription);
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await inBounds(page);
  await testInfo.attach("node-reading", { body: await page.screenshot(), contentType: "image/png" });
  await reader.locator(".content-reader__body").evaluate((body) => { body.scrollTop = body.scrollHeight; });
  await expect(reader.getByRole("button", { name: "편집", exact: true })).toBeVisible();
  await reader.getByRole("button", { name: "작게 보기", exact: true }).click();
  await expect(reader).not.toHaveAttribute("aria-modal", "true");
  await page.keyboard.press("Escape");
  await expect(reader).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Alt+Enter");
  await expect(reader).toBeVisible();
  await expect(reader).toHaveAttribute("aria-modal", "true");
  await reader.getByRole("button", { name: "전체 읽기 닫기", exact: true }).click();
  await expect(trigger).toBeFocused();
  expect(await viewport(page)).toBe(before);
  expect(await page.getByLabel("계획 버전", { exact: true }).locator("option").count()).toBe(options);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("roadmap reading keeps scroll and unsaved node edits, and explicitly opens the existing step editor", async ({ page }, testInfo) => {
  const { result, writes, errors } = await fixture(page);
  await page.locator(`.react-flow__node[data-id="${result.nodes[0]!.id}"] .custom-node__title`).click();
  await page.getByLabel("Node 이름", { exact: true }).fill("수정 중인 노드");
  const list = page.getByRole("list", { name: "로드맵 단계", exact: true });
  await list.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  const row = page.locator('.roadmap-step[data-step-id="reading-step-10"]');
  const trigger = row.locator(".roadmap-step__select");
  const scroll = await list.evaluate((element) => element.scrollLeft);
  const before = await viewport(page);
  const undoDisabled = await page.getByRole("button", { name: "편집 실행 취소", exact: true }).isDisabled();
  await trigger.dblclick();
  const reader = page.getByRole("dialog", { name: "실행 단계 10", exact: true });
  await expect(reader).toBeVisible();
  await expect(reader).toHaveAttribute("aria-modal", "true");
  await expect(reader).toHaveAttribute("data-expanded", "true");
  await expect(reader.locator(".content-reader__description")).toHaveText(`10단계 전문\n\n${longDescription}`);
  await expect(page.getByLabel("Node 이름", { exact: true })).toHaveValue("수정 중인 노드");
  await expect(row.locator(".roadmap-step__select")).toHaveAttribute("aria-pressed", "false");
  expect(await viewport(page)).toBe(before);
  expect(await list.evaluate((element) => element.scrollLeft)).toBe(scroll);
  expect(await page.getByRole("button", { name: "편집 실행 취소", exact: true, includeHidden: true }).isDisabled()).toBe(undoDisabled);
  await inBounds(page);
  await testInfo.attach("roadmap-reading", { body: await page.screenshot(), contentType: "image/png" });
  await reader.getByRole("button", { name: "편집", exact: true }).click();
  await expect(reader).toHaveCount(0);
  await expect(page.getByLabel("10단계 제목", { exact: true })).toBeFocused();
  const description = page.getByLabel("10단계 설명", { exact: true });
  const edited = `현재 수정 중인 단계\n\n${longDescription}`;
  await description.fill(edited);
  await page.getByRole("button", { name: "단계 편집 닫기", exact: true }).click();
  await trigger.dblclick();
  await expect(reader.locator(".content-reader__description")).toHaveText(edited);
  await page.keyboard.press("Escape");
  await page.locator(`.react-flow__node[data-id="${result.nodes[0]!.id}"] .custom-node__title`).click();
  await expect(page.getByLabel("Node 이름", { exact: true })).toHaveValue("수정 중인 노드");
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("reader closes on outside interaction, hidden sources and version changes without reopening stale content", async ({ page }) => {
  const { result, writes, errors } = await fixture(page);
  const trigger = page.locator(`.react-flow__node[data-id="${result.nodes[0]!.id}"]`);
  await trigger.dblclick();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await trigger.dblclick();
  await page.getByRole("dialog").getByRole("button", { name: "작게 보기", exact: true }).click();
  // Simulate hiding the anchor without pointer interaction outside the reader.
  await page.getByRole("button", { name: "로드맵 집중 보기", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "함께 보기", exact: true }).click();
  await trigger.dblclick();
  await page.getByRole("dialog").getByRole("button", { name: "작게 보기", exact: true }).click();
  const version = page.getByLabel("계획 버전", { exact: true });
  const old = await version.locator("option").evaluateAll((options) => options.find((option) => option.value !== "reading-current")!.value);
  await version.selectOption(old);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await version.selectOption("reading-current");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test.describe("touch reading", () => {
test.use({ hasTouch: true, isMobile: true });
test("mobile uses a bounded modal reader for nodes and roadmap with scrollable full text and focus restoration", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { result, writes, errors } = await fixture(page);
  await page.getByRole("button", { name: "그래프 집중 보기", exact: true }).click();
  const nodeTrigger = page.locator(`.react-flow__node[data-id="${result.nodes[0]!.id}"]`);
  await nodeTrigger.scrollIntoViewIfNeeded();
  const nodeBox = (await nodeTrigger.boundingBox())!;
  await page.touchscreen.tap(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2);
  await page.touchscreen.tap(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2);
  const reader = page.getByRole("dialog");
  await expect(reader).toHaveAttribute("aria-modal", "true");
  await expect(page.locator("#workspace-detail")).toHaveCount(0);
  await inBounds(page);
  await expect(reader.locator(".content-reader__description")).toHaveText(longDescription);
  await reader.locator(".content-reader__body").evaluate((body) => { body.scrollTop = body.scrollHeight; });
  await expect(reader.getByRole("button", { name: "편집", exact: true })).toBeVisible();
  await testInfo.attach("mobile-node-reading", { body: await page.screenshot(), contentType: "image/png" });
  await reader.getByRole("button", { name: "전체 읽기 닫기", exact: true }).click();
  await expect(nodeTrigger).toBeFocused();
  // Reading must not consume the canvas gesture's touchend or block the next drag.
  const beforeDrag = await nodeTrigger.evaluate((element) => (element as HTMLElement).style.transform);
  const dragBox = (await nodeTrigger.boundingBox())!;
  const touch = await page.context().newCDPSession(page);
  const dragX = dragBox.x + dragBox.width / 2, dragY = dragBox.y + dragBox.height / 2;
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: dragX, y: dragY }] });
  for (let index = 1; index <= 5; index++) {
    await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: dragX + index * 5, y: dragY + index * 3 }] });
  }
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await touch.detach();
  await expect.poll(() => nodeTrigger.evaluate((element) => (element as HTMLElement).style.transform)).not.toBe(beforeDrag);
  await expect(reader).toHaveCount(0);
  await expect(page.locator("#workspace-detail")).toHaveCount(0);
  await page.getByRole("button", { name: "편집 실행 취소", exact: true }).click();
  await expect.poll(() => nodeTrigger.evaluate((element) => (element as HTMLElement).style.transform)).toBe(beforeDrag);
  await page.getByRole("button", { name: "로드맵 집중 보기", exact: true }).click();
  const stepTrigger = page.locator(".roadmap-step__select").first();
  await stepTrigger.scrollIntoViewIfNeeded();
  const stepBox = (await stepTrigger.boundingBox())!;
  await page.touchscreen.tap(stepBox.x + stepBox.width / 2, stepBox.y + stepBox.height / 2);
  await page.touchscreen.tap(stepBox.x + stepBox.width / 2, stepBox.y + stepBox.height / 2);
  await expect(reader).toHaveAttribute("aria-modal", "true");
  await inBounds(page);
  await expect(reader.locator(".content-reader__description")).toHaveText(`1단계 전문\n\n${longDescription}`);
  await testInfo.attach("mobile-roadmap-reading", { body: await page.screenshot(), contentType: "image/png" });
  await page.keyboard.press("Escape");
  await expect(stepTrigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
});

test("double-clicking a node reads without opening the editor or zooming, while a single click still edits", async ({ page }) => {
  const { result, writes, errors } = await fixture(page);
  const node = page.locator(`.react-flow__node[data-id="${result.nodes[0]!.id}"]`);
  const before = await viewport(page);
  const coordinates = await node.getAttribute("style");
  await node.locator(".custom-node__title").dblclick({ delay: 90 });
  const reader = page.getByRole("dialog", { name: result.nodes[0]!.label });
  await expect(reader).toBeVisible();
  await expect(reader.locator(".content-reader__description")).toHaveText(longDescription);
  await expect(page.locator("#workspace-detail")).toHaveCount(0);
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(0);
  expect(await viewport(page)).toBe(before);
  expect(await node.getAttribute("style")).toBe(coordinates);
  await page.keyboard.press("Escape");
  await expect(node).toBeFocused();
  await node.locator(".custom-node__title").click();
  await expect(page.getByLabel("Node 이름", { exact: true })).toHaveValue(result.nodes[0]!.label);
  await page.getByLabel("Node 이름", { exact: true }).fill("수정 내용 보존");
  const shortNode = page.locator(`.react-flow__node[data-id="${result.nodes[1]!.id}"]`);
  await shortNode.locator(".custom-node__title").dblclick({ delay: 90 });
  await expect(page.getByRole("dialog").locator(".content-reader__description")).toHaveText("짧은 설명");
  await expect(page.getByLabel("Node 이름", { exact: true })).toHaveValue("수정 내용 보존");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "편집 실행 취소", exact: true })).toBeEnabled();
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("roadmap double-click keeps selection, unsaved edits and scroll, and cancels delayed clicks during other actions", async ({ page }) => {
  const { writes, errors } = await fixture(page);
  const list = page.getByRole("list", { name: "로드맵 단계", exact: true });
  await list.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  const row = page.locator('.roadmap-step[data-step-id="reading-step-10"]');
  const select = row.locator(".roadmap-step__select");
  const scroll = await list.evaluate((element) => element.scrollLeft);
  await select.dblclick({ delay: 90 });
  const reader = page.getByRole("dialog", { name: "실행 단계 10", exact: true });
  await expect(reader).toBeVisible();
  await expect(page.locator("#workspace-detail")).toHaveCount(0);
  await expect(select).toHaveAttribute("aria-pressed", "false");
  expect(await list.evaluate((element) => element.scrollLeft)).toBe(scroll);
  await page.keyboard.press("Escape");
  await expect(select).toBeFocused();
  await select.click();
  await expect(page.getByLabel("10단계 제목", { exact: true })).toBeVisible();
  await page.getByLabel("10단계 설명", { exact: true }).fill(`더블클릭 중에도 보존\n\n${longDescription}`);
  await select.dblclick({ delay: 90 });
  await expect(reader).toBeVisible();
  await expect(reader.locator(".content-reader__description")).toHaveText(`더블클릭 중에도 보존\n\n${longDescription}`);
  await expect(page.getByLabel("10단계 제목", { exact: true })).toBeVisible();
  await expect(select).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "단계 편집 닫기", exact: true }).click();
  await select.click();
  await page.getByRole("button", { name: "그래프 집중 보기", exact: true }).click();
  // Wait beyond the single-click decision window to catch a stale editor opening.
  await page.waitForTimeout(350);
  await expect(page.locator("#workspace-detail")).toHaveCount(0);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
