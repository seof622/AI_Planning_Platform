import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { mockPlanningResult } from "@ai-planning-platform/shared";

test("downloads saved, edited and historical plans without saving or restoring a version", async ({ page }, testInfo) => {
  const project = { ...mockPlanningResult.project!, title: "나의 계획" };
  const latest = { ...mockPlanningResult, project, summary: "최신 결과 요약", metadata: { ...mockPlanningResult.metadata, resultId: "export-latest" } };
  const historical = { ...latest, summary: "과거 결과 요약", metadata: { ...latest.metadata, resultId: "export-original" } };
  const history = [latest, historical].map((result) => ({ id: result.metadata.resultId, createdAt: result.metadata.generatedAt, summary: result.summary, model: "mock", canRestore: true }));
  const mutations: string[] = [];
  await page.route("http://localhost:8000/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== "GET") mutations.push(`${request.method()} ${path}`);
    let json: unknown;
    if (path === "/planning/models") json = { defaultModel: "mock", models: [{ id: "mock", label: "테스트 모델", description: "테스트", recommendedFor: "테스트", cost: "low", speed: "fast", quality: "standard" }] };
    else if (path === "/projects") json = [project];
    else if (path.endsWith("/planning-brief")) json = { requirement: "결과와 별개인 현재 Draft", brief: { planType: "project", successCriterion: "clarity", context: [], actionItems: [] }, selectedModel: "mock" };
    else if (path.endsWith("/planning-results")) json = history;
    else if (path.endsWith("/latest")) json = latest;
    else if (path.endsWith("/export-original")) json = historical;
    else { await route.fulfill({ status: 404, json: { detail: "Not found" } }); return; }
    await route.fulfill({ json });
  });
  await page.goto("/");
  const exportButton = page.getByRole("button", { name: "Markdown 내보내기", exact: true });
  await expect(exportButton).toBeEnabled();
  const downloadText = async (filename: string) => {
    const downloadEvent = page.waitForEvent("download");
    await exportButton.click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe(filename);
    const path = await download.path();
    expect(path).not.toBeNull();
    return readFile(path!, "utf8");
  };
  const saved = await downloadText("나의 계획-계획-v2.md");
  expect(saved).toContain(mockPlanningResult.requirement!.content.slice(0, -1));
  expect(saved).not.toContain("결과와 별개인 현재 Draft");
  expect(saved).toContain("최신 결과 요약");
  expect(saved).toContain("## 노드 연결");
  expect(saved).toContain("## 실행 로드맵");

  await page.locator(".react-flow__node").first().click();
  await page.getByLabel("Node 이름", { exact: true }).fill("저장 전 노드 수정");
  await page.getByRole("button", { name: "Node 편집 닫기", exact: true }).click();
  const edited = await downloadText("나의 계획-계획-v2-편집중.md");
  expect(edited).toContain("저장 전 노드 수정");
  expect(edited).toContain("저장 전 편집 포함");
  await expect(page.locator(".workspace__save-state")).toHaveAttribute("aria-label", "결과 편집 미저장");
  await expect(page.getByLabel("계획 버전").locator("option")).toHaveCount(2);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("계획 버전").selectOption("export-original");
  await expect(exportButton).toBeEnabled();
  const old = await downloadText("나의 계획-계획-v1.md");
  expect(old).toContain("과거 결과 요약");
  expect(old).not.toContain("저장 전 노드 수정");
  expect(mutations.filter((request) => !request.startsWith("PUT ") || !request.endsWith("/planning-brief"))).toEqual([]);
  await testInfo.attach("exported-plan", { body: old, contentType: "text/markdown" });
});

test("disables export for a project without a generated result", async ({ page }) => {
  await page.route("http://localhost:8000/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/planning/models") await route.fulfill({ json: { defaultModel: "mock", models: [] } });
    else await route.fulfill({ json: [] });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Markdown 내보내기", exact: true })).toBeDisabled();
});
