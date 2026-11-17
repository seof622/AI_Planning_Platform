import { expect, test, type Page } from "@playwright/test";
import { mockPlanningResult, type PlanningResult, type ProjectPlanningBrief } from "@ai-planning-platform/shared";
import { openRoadmapStep } from "./roadmapHelpers";

// Recovery failures are simulated locally: no AI calls or personal project writes.
async function setupRecoveryFixture(page: Page, options: {
  empty?: boolean;
  generationFailures?: number;
  generationGate?: Promise<void>;
  projectFailures?: number;
  projectGate?: Promise<void>;
  versionFailures?: number;
  versionGate?: Promise<void>;
  modelFailures?: number;
} = {}) {
  const project = { ...mockPlanningResult.project!, title: "복구 검증" };
  const original: PlanningResult = { ...mockPlanningResult, project,
    metadata: { ...mockPlanningResult.metadata, resultId: "original", model: "mock" } };
  const historical: PlanningResult = { ...original, summary: "과거 결과",
    nodes: original.nodes.map((node, index) => index === 0 ? { ...node, label: "과거 버전 노드" } : node),
    metadata: { ...original.metadata, resultId: "older" } };
  let latest = options.empty ? null : original;
  let draft: ProjectPlanningBrief = {
    requirement: original.requirement!.content,
    brief: { planType: "project", successCriterion: "clarity", context: ["개인 프로젝트"],
      actionItems: [{ necessity: "required", title: "첫 단계 준비" }] }, selectedModel: "mock",
  };
  const results = new Map<string, PlanningResult>([["original", original], ["older", historical]]);
  const briefs = new Map<string, ProjectPlanningBrief>([["original", draft], ["older", draft]]);
  const history = options.empty ? [] : [original, historical].map((result) => ({
    id: result.metadata.resultId!, createdAt: result.metadata.generatedAt, summary: result.summary, model: "mock", canRestore: true,
  }));
  const control = { generationCalls: 0, generationFailures: options.generationFailures ?? 0,
    projectFailures: options.projectFailures ?? 0, versionFailures: options.versionFailures ?? 0,
    modelFailures: options.modelFailures ?? 0, historyFailures: 0 };
  await page.route("http://localhost:8000/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/planning/models") {
      if (control.modelFailures-- > 0) {
        await route.fulfill({ status: 503, json: { detail: "모델 목록 연결 실패" } }); return;
      }
      await route.fulfill({ json: { defaultModel: "mock", models: [{ id: "mock", label: "테스트 모델",
        description: "테스트", recommendedFor: "테스트", cost: "low", speed: "fast", quality: "standard" }] } }); return;
    }
    if (path === "/projects") { await route.fulfill({ json: [project] }); return; }
    if (path.endsWith("/planning/generate")) {
      control.generationCalls += 1;
      await options.generationGate;
      if (control.generationFailures-- > 0) {
        await route.fulfill({ status: 503, json: { detail: "AI 서비스에 연결하지 못했습니다." } }); return;
      }
      const body = request.postDataJSON();
      const id = `generated-${control.generationCalls}`;
      latest = { ...original, requirement: { ...original.requirement!, content: body.requirement },
        nodes: original.nodes.map((node, index) => index === 0 ? { ...node, label: "재생성된 노드" } : node),
        metadata: { ...original.metadata, resultId: id } };
      results.set(id, latest);
      briefs.set(id, { requirement: body.requirement, brief: body.brief, selectedModel: body.options.model });
      history.unshift({ id, createdAt: latest.metadata.generatedAt, summary: latest.summary, model: "mock", canRestore: true });
      await route.fulfill({ json: latest }); return;
    }
    if (path.endsWith("/planning-results/latest")) {
      await options.projectGate;
      if (control.projectFailures-- > 0) {
        await route.fulfill({ status: 503, json: { detail: "프로젝트 조회 연결 실패" } }); return;
      }
      await route.fulfill({ status: latest ? 200 : 404, json: latest ?? { detail: "No result" } }); return;
    }
    if (path.endsWith("/planning-results")) {
      if (control.historyFailures-- > 0) {
        await route.fulfill({ status: 503, json: { detail: "이력 조회 연결 실패" } }); return;
      }
      await route.fulfill({ json: history }); return;
    }
    const version = path.match(/\/planning-results\/([^/]+)(\/planning-brief)?$/);
    if (version) {
      if (version[1] === "older" && !version[2]) {
        await options.versionGate;
        // The hidden comparison panel may also read this version; fail all reads until recovery.
        if (control.versionFailures > 0) {
          await route.fulfill({ status: 503, json: { detail: "버전 조회 연결 실패" } }); return;
        }
      }
      await route.fulfill({ json: version[2] ? briefs.get(version[1]!) : results.get(version[1]!) }); return;
    }
    if (path.endsWith("/planning-brief")) {
      if (request.method() === "PUT") draft = request.postDataJSON();
      await route.fulfill({ json: draft }); return;
    }
    await route.fulfill({ status: 404, json: { detail: "Not found" } });
  });
  return { control, original };
}

test("failed regeneration keeps the graph, roadmap, selection and edits until explicit retry", async ({ page }, testInfo) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const { control, original } = await setupRecoveryFixture(page, { generationFailures: 1, generationGate: gate });
  await page.goto("/");
  await page.locator(".react-flow__node").first().click();
  await page.getByLabel("Node 이름", { exact: true }).fill("유지할 노드 편집");
  await openRoadmapStep(page, 1);
  await page.getByLabel("1단계 제목", { exact: true }).fill("유지할 단계 편집");
  async function readViewport() {
    return page.locator(".react-flow").evaluate((canvas) => {
      const matrix = new DOMMatrixReadOnly(canvas.querySelector<HTMLElement>(".react-flow__viewport")!.style.transform);
      return { zoom: matrix.a, x: (canvas.clientWidth / 2 - matrix.e) / matrix.a,
        y: (canvas.clientHeight / 2 - matrix.f) / matrix.a };
    });
  }
  const originalViewport = await readViewport();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "새 버전으로 다시 생성", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status", { name: "AI 생성 중", exact: true })).toBeVisible();
  await expect(page.locator(".react-flow__node").first()).toContainText("유지할 노드 편집");
  await expect(page.getByLabel("Node 이름", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("1단계 제목", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("1단계 제목", { exact: true })).toHaveValue("유지할 단계 편집");
  await expect(page.getByLabel("계획 요구사항", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "생성 중", exact: true })).toBeDisabled();
  await expect(page.getByRole("timer")).toContainText(/\d+초/);
  await expect(page.locator("#planning-canvas")).toHaveAttribute("data-generating", "true");
  await expect(page.locator("#planning-roadmap")).toHaveAttribute("data-generating", "true");
  await expect(page.locator("#planning-canvas .design-workshop")).toBeVisible();
  await expect(page.locator("#planning-roadmap .roadmap-workshop")).toBeVisible();
  await testInfo.attach("regenerating-existing-result", { body: await page.screenshot(), contentType: "image/png" });
  expect(control.generationCalls).toBe(1);
  release();
  const failure = page.getByRole("alert", { name: "AI 생성 실패", exact: true });
  await expect(failure).toContainText("기존 결과 유지");
  await expect(failure).toContainText("AI 서비스에 연결하지 못했습니다.");
  await expect(page.locator("#planning-canvas")).toHaveAttribute("data-generating", "false");
  await expect(page.locator("#planning-roadmap")).toHaveAttribute("data-generating", "false");
  await expect(page.locator(".generation-preview")).toHaveCount(0);
  await expect(page.getByLabel("1단계 제목", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("계획 버전", { exact: true })).toHaveValue("original");
  await expect(page.getByLabel("계획 요구사항", { exact: true })).toHaveValue(original.requirement!.content);
  await expect(page.locator(".workspace__save-state")).toHaveAttribute("aria-label", "결과 편집 미저장");
  await expect(async () => {
    const retained = await readViewport();
    expect(retained.zoom).toBeCloseTo(originalViewport.zoom, 5);
    expect(retained.x).toBeCloseTo(originalViewport.x, 0);
    expect(retained.y).toBeCloseTo(originalViewport.y, 0);
  }).toPass({ timeout: 10_000 });
  await testInfo.attach("retained-result-after-generation-error", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  page.once("dialog", (dialog) => dialog.accept());
  await failure.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.locator(".react-flow__node").first()).toContainText("재생성된 노드");
  await expect(page.getByLabel("계획 버전", { exact: true })).toHaveValue("generated-2");
  await expect(failure).toHaveCount(0);
  expect(control.generationCalls).toBe(2);
});

test("generation keeps distinct animated workshops inside the graph and roadmap panels at every screen size", async ({ page }, testInfo) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const { control } = await setupRecoveryFixture(page, { empty: true, generationGate: gate });
  await page.goto("/");
  await page.getByRole("button", { name: "계획 생성", exact: true }).click();
  const graph = page.locator("#planning-canvas");
  const roadmap = page.locator("#planning-roadmap");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".workspace__header").getByRole("status", { name: "AI 생성 중", exact: true })).toBeVisible();
  await expect(page.locator(".workspace__results .operation-feedback")).toHaveCount(0);
  await expect(page.getByText("AI 구성 중", { exact: true })).toHaveCount(0);
  await expect(graph.locator(".status-view")).toHaveCount(0);
  await expect(page.getByRole("status", { name: "AI 생성 중", exact: true })).toBeVisible();
  await expect(graph).toHaveAttribute("aria-busy", "true");
  await expect(roadmap).toHaveAttribute("aria-busy", "true");
  await expect(graph.locator(".design-workshop")).toBeVisible();
  await expect(graph.locator(".roadmap-workshop")).toHaveCount(0);
  await expect(roadmap.locator(".roadmap-workshop")).toBeVisible();
  await expect(roadmap.locator(".design-workshop")).toHaveCount(0);
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  async function timeline(time: number) {
    await page.locator(".generation-preview").evaluateAll((scenes, at) => scenes.forEach((scene) =>
      scene.getAnimations({ subtree: true }).forEach((animation) => { animation.pause(); animation.currentTime = at; })), time);
  }
  async function bounded() {
    for (const panel of [graph, roadmap]) {
      const bounds = (await panel.boundingBox())!;
      for (const child of [panel.locator(".generation-preview"), panel.locator(".generation-preview > svg")]) {
        const box = (await child.boundingBox())!;
        expect(box.width).toBeGreaterThan(100);
        expect(box.height).toBeGreaterThan(30);
        expect(box.x).toBeGreaterThanOrEqual(bounds.x);
        expect(box.y).toBeGreaterThanOrEqual(bounds.y);
        expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
        expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await timeline(0);
  const firstPosition = await graph.locator(".design-workshop__plotter").evaluate((tool) => getComputedStyle(tool).transform);
  const firstPress = await roadmap.locator(".roadmap-workshop__press").evaluate((tool) => getComputedStyle(tool).transform);
  await expect(graph.locator(".design-workshop__module--3")).toHaveCSS("opacity", "0");
  await expect(roadmap.locator(".roadmap-workshop__card--2")).toHaveCSS("opacity", "0");
  await timeline(9400);
  expect(await graph.locator(".design-workshop__plotter").evaluate((tool) => getComputedStyle(tool).transform)).not.toBe(firstPosition);
  expect(await roadmap.locator(".roadmap-workshop__press").evaluate((tool) => getComputedStyle(tool).transform)).not.toBe(firstPress);
  await expect(graph.locator(".design-workshop__module--3")).toHaveCSS("opacity", "1");
  await expect(roadmap.locator(".roadmap-workshop__card--2")).toHaveCSS("opacity", "1");
  await expect(roadmap.locator(".roadmap-workshop__stamp--2")).toHaveCSS("opacity", "1");
  await bounded();
  await testInfo.attach("panel-workshops-desktop", { body: await page.screenshot({ path: "build/local-runtime/panel-workshops-desktop.png" }), contentType: "image/png" });
  await page.setViewportSize({ width: 1024, height: 768 });
  await bounded();
  await testInfo.attach("panel-workshops-compact", { body: await page.screenshot({ path: "build/local-runtime/panel-workshops-compact.png" }), contentType: "image/png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await bounded();
  await testInfo.attach("panel-workshops-mobile", { body: await page.screenshot({ path: "build/local-runtime/panel-workshops-mobile.png", fullPage: true }), contentType: "image/png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await graph.locator(".design-workshop__plotter").evaluate((tool) => getComputedStyle(tool).animationName)).toBe("none");
  expect(await roadmap.locator(".roadmap-workshop__press").evaluate((tool) => getComputedStyle(tool).animationName)).toBe("none");
  await expect(graph.locator(".design-workshop__module--3")).toHaveCSS("opacity", "1");
  await expect(roadmap.locator(".roadmap-workshop__card--2")).toHaveCSS("opacity", "1");
  release();
  await expect(page.locator(".react-flow__node").first()).toContainText("재생성된 노드");
  await expect(page.locator(".generation-preview")).toHaveCount(0);
  await expect(graph).toHaveAttribute("aria-busy", "false");
  await expect(roadmap).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("status", { name: "AI 생성 중", exact: true })).toHaveCount(0);
  expect(control.generationCalls).toBe(1);
});

test("regeneration keeps the right workshop and generation notice in focused graph and roadmap views", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const { control } = await setupRecoveryFixture(page, { generationGate: gate });
  await page.goto("/");
  await page.getByRole("button", { name: "새 버전으로 다시 생성", exact: true }).click();
  await page.getByRole("button", { name: "그래프 집중 보기", exact: true }).click();
  await expect(page.locator("#planning-canvas .design-workshop")).toBeVisible();
  await expect(page.locator("#planning-roadmap")).toBeHidden();
  await expect(page.getByRole("status", { name: "AI 생성 중", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "로드맵 집중 보기", exact: true }).click();
  await expect(page.locator("#planning-roadmap .roadmap-workshop")).toBeVisible();
  await expect(page.locator("#planning-canvas")).toBeHidden();
  await expect(page.getByRole("status", { name: "AI 생성 중", exact: true })).toBeVisible();
  release();
  await expect(page.locator(".generation-preview")).toHaveCount(0);
  await expect(page.locator("#planning-roadmap .roadmap__steps")).toBeVisible();
  expect(control.generationCalls).toBe(1);
});
test("initial failure retains the input and the empty view leads to the first input", async ({ page }) => {
  const { control, original } = await setupRecoveryFixture(page, { empty: true, generationFailures: 1 });
  await page.goto("/");
  await page.getByRole("button", { name: "계획 입력 접기", exact: true }).click();
  await page.getByRole("button", { name: "계획 입력", exact: true }).click();
  await expect(page.getByLabel("계획 요구사항", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "계획 생성", exact: true }).click();
  const failure = page.getByRole("alert", { name: "AI 생성 실패", exact: true });
  await expect(failure).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect(page.getByLabel("계획 요구사항", { exact: true })).toHaveValue(original.requirement!.content);
  expect(control.generationCalls).toBe(1);
  await failure.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  expect(control.generationCalls).toBe(2);
});

test("project loading has its own label and can retry without generating a plan", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const { control } = await setupRecoveryFixture(page, { projectFailures: 1, projectGate: gate });
  await page.goto("/");
  await expect(page.getByRole("status", { name: "프로젝트 불러오는 중", exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: "AI 생성 중", exact: true })).toHaveCount(0);
  release();
  const failure = page.getByRole("alert", { name: "프로젝트 조회 실패", exact: true });
  await expect(failure).toContainText("프로젝트 조회 연결 실패");
  await failure.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  expect(control.generationCalls).toBe(0);
});

test("version lookup failures preserve the displayed result and retry the chosen version", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const { control, original } = await setupRecoveryFixture(page, { versionFailures: 1, versionGate: gate });
  await page.goto("/");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  const version = page.getByLabel("계획 버전", { exact: true });
  await version.selectOption("older");
  await expect(page.getByRole("status", { name: "버전 불러오는 중", exact: true })).toBeVisible();
  await expect(page.locator(".react-flow__node").first()).toContainText(original.nodes[0]!.label);
  release();
  const failure = page.getByRole("alert", { name: "버전 조회 실패", exact: true });
  await expect(failure).toBeVisible();
  await expect(version).toHaveValue("original");
  control.versionFailures = 0;
  await failure.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(version).toHaveValue("older");
  await expect(page.locator(".react-flow__node").first()).toContainText("과거 버전 노드");
  expect(control.generationCalls).toBe(0);
});

test("roadmap focus keeps version progress, failure and retry visible with the input collapsed", async ({ page }, testInfo) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const { control } = await setupRecoveryFixture(page, { versionFailures: 1, versionGate: gate });
  await page.goto("/");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.getByRole("button", { name: "로드맵 집중 보기", exact: true }).click();
  await page.getByRole("button", { name: "계획 입력 접기", exact: true }).click();
  await page.getByLabel("계획 버전", { exact: true }).selectOption("older");
  const roadmap = page.getByRole("region", { name: "계획 로드맵", exact: true });
  await expect(roadmap.getByRole("status", { name: "버전 불러오는 중", exact: true })).toBeVisible();
  await expect(page.locator(".canvas-shell")).toBeHidden();
  release();
  const failure = roadmap.getByRole("alert", { name: "버전 조회 실패", exact: true });
  await expect(failure).toBeFocused();
  await expect(failure.getByRole("button", { name: "다시 시도", exact: true })).toBeInViewport();
  await testInfo.attach("roadmap-focus-recovery", { body: await page.screenshot(), contentType: "image/png" });
  control.versionFailures = 0;
  await failure.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByLabel("계획 버전", { exact: true })).toHaveValue("older");
  await expect(failure).toHaveCount(0);
  expect(control.generationCalls).toBe(0);
});

test("catalog and history can retry independently without repeating successful generation", async ({ page }) => {
  const { control } = await setupRecoveryFixture(page, { modelFailures: 1 });
  await page.goto("/");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "새 버전으로 다시 생성", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "모델 다시 불러오기", exact: true }).click();
  control.historyFailures = 1;
  await page.getByRole("button", { name: "새 버전으로 다시 생성", exact: true }).click();
  await expect(page.locator(".react-flow__node").first()).toContainText("재생성된 노드");
  await expect(page.getByLabel("계획 버전", { exact: true })).toHaveValue("generated-1");
  await expect(page.getByRole("alert", { name: "AI 생성 실패", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "이력 다시 불러오기", exact: true }).click();
  await expect(page.getByRole("button", { name: "이력 다시 불러오기", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("계획 버전", { exact: true }).locator("option")).toHaveCount(3);
  expect(control.generationCalls).toBe(1);
});

test("mobile generation failure brings the retained result and retry into view", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupRecoveryFixture(page, { generationFailures: 1 });
  await page.goto("/");
  await page.getByRole("button", { name: "새 버전으로 다시 생성", exact: true }).click();
  const failure = page.getByRole("alert", { name: "AI 생성 실패", exact: true });
  await expect(failure).toBeFocused();
  await expect(failure).toBeInViewport();
  await expect(failure.getByRole("button", { name: "다시 시도", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await testInfo.attach("mobile-generation-recovery", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await failure.getByRole("button", { name: "오류 안내 닫기", exact: true }).click();
  await expect(failure).toHaveCount(0);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
});
