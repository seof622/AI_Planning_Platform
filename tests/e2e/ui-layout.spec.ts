import { expect, test } from "@playwright/test";
import { mockPlanningResult } from "@ai-planning-platform/shared";
import type { ProjectPlanningBrief } from "@ai-planning-platform/shared";
import { openRoadmapStep } from "./roadmapHelpers";

async function expectNoOverflow(page: import("@playwright/test").Page, width: number, height?: number) {
  const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
  expect(size.width).toBeLessThanOrEqual(width);
  if (height) expect(size.height).toBeLessThanOrEqual(height);
}

// Layout checks use a fixture so they do not create or modify personal projects.
test.beforeEach(async ({ page }) => {
  const project = { ...mockPlanningResult.project!, title: "나만의 계획 서비스" };
  const result = { ...mockPlanningResult, project, metadata: { ...mockPlanningResult.metadata, resultId: "layout-result" } };
  const brief = { requirement: mockPlanningResult.requirement!.content,
    brief: { planType: "project", successCriterion: "clarity", context: ["개인 프로젝트"], actionItems: [] }, selectedModel: "mock" };
  await page.route("http://localhost:8000/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/planning-reviews")) { await route.fulfill({ json: [] }); return; }
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
  await expect(page.getByRole("button", { name: "Markdown 내보내기", exact: true })).toHaveText("");
  await expect(page.locator(".history-panel__details > summary")).toHaveAccessibleName("버전 정보·비교");
  await expect(page.locator(".history-panel__details > summary")).toHaveText("");
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
  // Opening the inspector preserves the current view; explicit fit shows all nodes again.
  await page.getByRole("button", { name: "전체 보기", exact: true }).click();
  await expect(async () => {
    expect(await page.locator(".react-flow").evaluate((canvas) => {
      const area = canvas.getBoundingClientRect();
      return [...canvas.querySelectorAll(".react-flow__node")].every((node) => {
        const box = node.getBoundingClientRect();
        return box.left >= area.left && box.right <= area.right;
      });
    })).toBe(true);
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
  const generate = page.getByRole("button", { name: "AI 입력 검토", exact: true });
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
  await expect(page.locator(".workspace__save-state")).toBeVisible();
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
  const generate = await page.getByRole("button", { name: "AI 입력 검토", exact: true }).boundingBox();
  expect(generate!.y + generate!.height).toBeLessThanOrEqual(768);
  const toolbar = page.locator(".graph-edit-panel");
  await expect(toolbar.getByRole("button", { name: "변경 내용을 새 버전으로 저장", exact: true })).toBeVisible();
  await toolbar.locator(".graph-edit-panel__help > summary").click();
  await expect(page.getByText("저장은 노드·연결·로드맵 편집 전체를 새 버전으로 기록합니다. 입력 초안은 별도로 자동 저장됩니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "연결 도움말 닫기", exact: true })).toBeInViewport();
  await page.getByRole("button", { name: "연결 도움말 닫기", exact: true }).click();
  await testInfo.attach("workspace-compact-desktop", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});

test("draft retry, unapplied inputs and the full result save scope remain distinct", async ({ page }, testInfo) => {
  let savedBrief: ProjectPlanningBrief | null = null;
  let shouldFail = true;
  await page.route("http://localhost:8000/projects/**/planning-brief", async (route) => {
    if (route.request().method() === "PUT") {
      if (shouldFail) {
        shouldFail = false;
        await route.fulfill({ status: 503, json: { detail: "초안 저장 연결 실패" } });
      } else {
        savedBrief = route.request().postDataJSON();
        await route.fulfill({ json: savedBrief });
      }
    } else if (savedBrief && !new URL(route.request().url()).pathname.includes("/planning-results/")) {
      await route.fulfill({ json: savedBrief });
    } else await route.fallback();
  });
  await page.goto("/");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  const generate = page.getByRole("button", { name: "AI 입력 검토", exact: true });
  await expect(generate).toBeEnabled();
  await expect(generate).toHaveAccessibleDescription(/AI 피드백과 모델을 확인한 뒤 계획을 생성합니다/);
  await page.getByLabel("계획 요구사항", { exact: true }).fill("입력을 바꾼 계획");
  await expect(page.getByText("입력 변경됨", { exact: true })).toBeVisible();
  await expect(page.getByLabel("입력 초안 저장 상태")).toContainText("입력 초안 자동 저장 실패");
  await expect(page.locator(".workspace__save-state")).toHaveAttribute("aria-label", "결과 편집 저장됨");
  await page.getByRole("button", { name: "입력 초안 저장 재시도", exact: true }).click();
  await expect(page.getByLabel("입력 초안 저장 상태")).toContainText("입력 초안 자동 저장됨");
  await page.reload();
  await expect(page.getByLabel("계획 요구사항", { exact: true })).toHaveValue("입력을 바꾼 계획");
  await expect(page.getByText("입력 변경됨", { exact: true })).toBeVisible();
  await page.getByLabel("해야 할 일 1", { exact: true }).fill("첫 단계 준비");
  await expect(generate).toBeEnabled();
  await page.locator(".react-flow__node").first().click();
  await page.getByLabel("Node 이름", { exact: true }).fill("결과 노드 수정");
  await openRoadmapStep(page, 1);
  await page.getByLabel("1단계 제목", { exact: true }).fill("결과 단계 수정");
  const saves = page.getByRole("button", { name: "변경 내용을 새 버전으로 저장", exact: true });
  await expect(saves).toHaveCount(3);
  for (const button of await saves.all()) {
    await expect(button).toBeEnabled();
    await expect(button).toHaveAccessibleDescription("노드·연결·로드맵 편집 전체 저장");
    await expect(button).toHaveText("저장");
  }
  await expect(page.locator(".workspace__save-state")).toHaveAttribute("aria-label", "결과 편집 미저장");
  await expect(page.getByLabel("입력 초안 저장 상태")).toContainText("입력 초안 자동 저장됨");
  await testInfo.attach("save-generation-guidance", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});

test("ten roadmap steps are readable and share a single selected-item editor with graph nodes", async ({ page }, testInfo) => {
  const steps = Array.from({ length: 10 }, (_, index) => ({ ...mockPlanningResult.roadmap[0]!,
    id: `reading-${index + 1}`, order: index + 1, title: `${index + 1}번째 실행`, description: `실행 설명 ${index + 1}`,
    dependsOn: index ? [`reading-${index}`] : [] }));
  await page.route("http://localhost:8000/projects/*/planning-results/latest", (route) => route.fulfill({ json: {
    ...mockPlanningResult, roadmap: steps, metadata: { ...mockPlanningResult.metadata, resultId: "layout-result" },
  } }));
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");
  const roadmap = page.getByRole("region", { name: "계획 로드맵", exact: true });
  await expect(roadmap.locator(".roadmap-step")).toHaveCount(10);
  await expect(roadmap.locator("input, textarea, select")).toHaveCount(0);
  await expect(page.locator(".detail-drawer--open")).toHaveCount(0);
  const cards = await roadmap.locator(".roadmap-step").evaluateAll((items) => items.map((item) => {
    const box = item.getBoundingClientRect();
    return { x: box.x, y: box.y };
  }));
  expect(cards[1]!.x).toBeGreaterThan(cards[0]!.x);
  expect(cards[1]!.y).toBe(cards[0]!.y);
  const list = roadmap.getByRole("list", { name: "로드맵 단계", exact: true });
  const firstButton = roadmap.locator(".roadmap-step__select").first();
  const start = await firstButton.boundingBox();
  await page.mouse.move(start!.x + 180, start!.y + 50);
  await page.mouse.down();
  await page.mouse.move(start!.x - 60, start!.y + 50, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => list.evaluate((element) => element.scrollLeft)).toBeGreaterThan(150);
  await expect(page.locator(".detail-drawer--open")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "편집 실행 취소", exact: true })).toBeDisabled();
  // A regular click after dragging must still select a card.
  await roadmap.locator(".roadmap-step__select").nth(1).click();
  await expect(page.getByLabel("2단계 제목", { exact: true })).toHaveValue("2번째 실행");
  await page.getByRole("button", { name: "단계 편집 닫기", exact: true }).click();
  const last = roadmap.locator('[data-step-id="reading-10"] > button');
  await last.focus();
  await page.keyboard.press("Enter");
  const editor = page.getByRole("complementary", { name: "로드맵 단계 편집", exact: true });
  await expect(editor.getByLabel("10단계 제목", { exact: true })).toHaveValue("10번째 실행");
  await expect(page.getByLabel("1단계 제목", { exact: true })).toHaveCount(0);
  await editor.getByLabel("10단계 제목", { exact: true }).fill("수정한 열 번째 단계");
  await editor.getByRole("button", { name: "단계 편집 닫기", exact: true }).click();
  await expect(last).toBeFocused();
  await expect(last).toContainText("수정한 열 번째 단계");
  await page.locator(".react-flow__node").first().click();
  await page.getByLabel("Node 이름", { exact: true }).fill("전환해도 유지하는 노드");
  await openRoadmapStep(page, "reading-10");
  await expect(page.getByLabel("Node 이름", { exact: true })).toHaveCount(0);
  await expect(editor.getByLabel("10단계 제목", { exact: true })).toHaveValue("수정한 열 번째 단계");
  await expect(page.locator(".react-flow__node").first()).toContainText("전환해도 유지하는 노드");
  await expect(page.locator(".detail-drawer--open")).toHaveCount(1);
  await expect(last).toHaveAttribute("aria-pressed", "true");
  const bounds = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight,
    listWidth: document.querySelector(".roadmap__steps")!.clientWidth,
    listScrollWidth: document.querySelector(".roadmap__steps")!.scrollWidth,
  }));
  expect(bounds.pageWidth).toBeLessThanOrEqual(1440);
  expect(bounds.pageHeight).toBeLessThanOrEqual(960);
  expect(bounds.listScrollWidth).toBeGreaterThan(bounds.listWidth);
  await expect(last).toBeInViewport({ ratio: 1 });
  await testInfo.attach("roadmap-reading-desktop", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});

test("focus views and collapsed inputs preserve edits, selection and canvas controls", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.getByLabel("계획 요구사항", { exact: true }).fill("접어도 유지할 입력");
  await page.locator(".brief-options > summary").click();
  await page.getByLabel("제약 조건", { exact: true }).fill("유지할 세부 조건");
  await page.getByRole("button", { name: "미니맵 표시", exact: true }).click();
  await page.locator(".react-flow__node").first().click();
  await page.getByLabel("Node 이름", { exact: true }).fill("보기 전환 후에도 유지할 노드");
  await page.getByRole("button", { name: "그래프 집중 보기", exact: true }).click();
  await expect(page.locator(".roadmap")).toBeHidden();
  await expect(page.getByLabel("Node 이름", { exact: true })).toHaveValue("보기 전환 후에도 유지할 노드");
  await page.getByRole("button", { name: "로드맵 집중 보기", exact: true }).click();
  await expect(page.locator(".canvas-shell")).toBeHidden();
  await expect(page.locator(".roadmap")).toBeVisible();
  await openRoadmapStep(page, 1);
  await page.getByLabel("1단계 제목", { exact: true }).fill("집중 보기에서 수정한 단계");
  await page.getByRole("button", { name: "계획 입력 접기", exact: true }).click();
  await expect(page.locator(".workspace__sidebar")).toBeHidden();
  await expect(page.getByLabel("1단계 제목", { exact: true })).toHaveValue("집중 보기에서 수정한 단계");
  await expectNoOverflow(page, 1440, 960);
  await testInfo.attach("roadmap-focus-collapsed", { body: await page.screenshot(), contentType: "image/png" });
  await page.getByRole("button", { name: "함께 보기", exact: true }).click();
  await expect(page.locator(".react-flow__minimap")).toBeVisible();
  await expect(page.locator(".react-flow__node").first()).toContainText("보기 전환 후에도 유지할 노드");
  await page.getByRole("button", { name: "계획 입력 펼치기", exact: true }).click();
  await expect(page.getByLabel("계획 요구사항", { exact: true })).toHaveValue("접어도 유지할 입력");
  await expect(page.getByLabel("제약 조건", { exact: true })).toHaveValue("유지할 세부 조건");
  await expect(page.locator(".workspace__save-state")).toHaveAttribute("aria-label", "결과 편집 미저장");
  await page.getByRole("button", { name: "화면 배치 초기화", exact: true }).click();
  await expect(page.getByLabel("1단계 제목", { exact: true })).toHaveValue("집중 보기에서 수정한 단계");
});

test("panel resizing is bounded, keyboard accessible, persistent and resettable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  async function drag(label: string, dx: number, dy: number) {
    const handle = page.getByRole("separator", { name: label, exact: true });
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 6 });
    await page.mouse.up();
  }
  const input = page.getByRole("separator", { name: "입력 패널 너비 조절", exact: true });
  await drag("입력 패널 너비 조절", 60, 0);
  await expect(input).toHaveAttribute("aria-valuenow", "364");
  expect((await page.locator(".workspace__sidebar").boundingBox())!.width).toBeCloseTo(364, 0);
  const split = page.getByRole("separator", { name: "그래프와 로드맵 높이 조절", exact: true });
  const initialGraph = (await page.locator(".canvas-shell").boundingBox())!.height;
  await drag("그래프와 로드맵 높이 조절", 0, 60);
  expect((await page.locator(".canvas-shell").boundingBox())!.height).toBeGreaterThan(initialGraph + 40);
  await split.focus();
  await page.keyboard.press("End");
  await expect(split).toHaveAttribute("aria-valuenow", "75");
  await page.keyboard.press("Home");
  await expect(split).toHaveAttribute("aria-valuenow", "25");
  await page.keyboard.press("ArrowDown");
  await expect(split).toHaveAttribute("aria-valuenow", "27");
  await openRoadmapStep(page, 1);
  const detail = page.getByRole("separator", { name: "상세 편집 너비 조절", exact: true });
  await drag("상세 편집 너비 조절", -50, 0);
  await expect(detail).toHaveAttribute("aria-valuenow", "350");
  expect((await page.locator(".detail-drawer--open").boundingBox())!.width).toBeCloseTo(350, 0);
  await input.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowRight");
  await expect(input).toHaveAttribute("aria-valuenow", "420");
  await detail.focus();
  await page.keyboard.press("End");
  await expectNoOverflow(page, 1440, 960);
  await testInfo.attach("workspace-resized", { body: await page.screenshot(), contentType: "image/png" });
  await detail.dblclick();
  await expect(detail).toHaveAttribute("aria-valuenow", "300");
  await expect(page.locator(".workspace__save-state")).toHaveAttribute("aria-label", "결과 편집 저장됨");
  await page.getByRole("button", { name: "로드맵 집중 보기", exact: true }).click();
  await page.getByRole("button", { name: "계획 입력 접기", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("plannote.workspace-layout.v1") ?? "{}").inputCollapsed)).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "로드맵 집중 보기", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".workspace__sidebar")).toBeHidden();
  await expect(page.locator(".canvas-shell")).toBeHidden();
  await page.getByRole("button", { name: "함께 보기", exact: true }).click();
  await page.getByRole("button", { name: "계획 입력 펼치기", exact: true }).click();
  await expect(input).toHaveAttribute("aria-valuenow", "420");
  await expect(split).toHaveAttribute("aria-valuenow", "27");
  await page.getByRole("button", { name: "화면 배치 초기화", exact: true }).click();
  await expect(input).toHaveAttribute("aria-valuenow", "304");
  await expect(split).toHaveAttribute("aria-valuenow", "56");
  await page.setViewportSize({ width: 1024, height: 768 });
  await input.focus();
  await page.keyboard.press("End");
  await expectNoOverflow(page, 1024, 768);
});

test("mobile focus views keep controls and editor in bounds without desktop resize handles", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.getByRole("button", { name: "계획 입력 접기", exact: true }).click();
  await page.getByRole("button", { name: "로드맵 집중 보기", exact: true }).click();
  await expect(page.locator(".canvas-shell")).toBeHidden();
  await expect(page.getByRole("separator")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "단계 추가", exact: true })).toBeInViewport();
  await openRoadmapStep(page, 1);
  await page.getByLabel("1단계 제목", { exact: true }).click();
  await expect(page.getByLabel("1단계 제목", { exact: true })).toBeFocused();
  await page.getByLabel("1단계 제목", { exact: true }).fill("모바일 집중 보기 수정");
  await expectNoOverflow(page, 390);
  await testInfo.attach("workspace-mobile-focus", { body: await page.screenshot(), contentType: "image/png" });
  await page.getByRole("button", { name: "단계 편집 닫기", exact: true }).click();
  await page.getByRole("button", { name: "그래프 집중 보기", exact: true }).click();
  await expect(page.locator(".roadmap")).toBeHidden();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.getByRole("button", { name: "함께 보기", exact: true }).click();
  await expect(page.getByRole("button", { name: "1단계 모바일 집중 보기 수정 편집", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "계획 입력 펼치기", exact: true }).click();
  await expect(page.getByLabel("계획 요구사항", { exact: true })).toBeVisible();
  await expectNoOverflow(page, 390);
});

test("mobile roadmap selection opens one bounded editor and closing keeps the edit", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const editor = await openRoadmapStep(page, 1);
  await editor.getByLabel("1단계 제목", { exact: true }).fill("모바일에서 수정한 단계");
  const bounds = await editor.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await expect(page.locator(".detail-drawer--open")).toHaveCount(1);
  await testInfo.attach("roadmap-reading-mobile", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await editor.getByRole("button", { name: "단계 편집 닫기", exact: true }).click();
  await expect(page.getByRole("button", { name: "1단계 모바일에서 수정한 단계 편집", exact: true })).toBeFocused();
  await expect(page.locator(".detail-drawer--open")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const list = page.getByRole("list", { name: "로드맵 단계", exact: true });
  await list.scrollIntoViewIfNeeded();
  const box = await list.boundingBox();
  const touch = await page.context().newCDPSession(page);
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  const x = box!.x + box!.width - 30;
  const y = box!.y + 60;
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 10; step++) {
    await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - step * 22, y }] });
  }
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => list.evaluate((element) => element.scrollLeft)).toBeGreaterThan(100);
  await expect(page.locator(".detail-drawer--open")).toHaveCount(0);
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await touch.detach();
  const last = page.locator(".roadmap-step__select").last();
  await last.focus();
  await page.keyboard.press("Enter");
  await editor.getByRole("button", { name: "단계 편집 닫기", exact: true }).click();
  await expect(last).toBeFocused();
  await expect(last).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
