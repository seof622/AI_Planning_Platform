import { execFileSync } from "node:child_process";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import type { PlanningResult, PlanningResultHistoryItem } from "@ai-planning-platform/shared";

const api = "http://localhost:8000";
function seedProject(): { projectId: string; resultId: string } {
  return JSON.parse(execFileSync("docker", ["compose", "exec", "-T", "api", "uv", "run", "--frozen", "python", "-m", "scripts.seed_editing_e2e"], { encoding: "utf8", timeout: 30_000 }).trim());
}
async function json<T>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(`${api}${path}`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}
async function openProject(page: Page, id: string) {
  await page.goto("/");
  await expect(page.getByLabel("프로젝트", { exact: true })).toBeEnabled();
  await page.getByLabel("프로젝트", { exact: true }).selectOption(id);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
}
async function clickSave(page: Page, status: number) {
  const saved = page.waitForResponse((response) => response.url().endsWith("/edit") && response.request().method() === "POST");
  await page.getByRole("button", { name: "편집본 새 버전 저장", exact: true }).click();
  expect((await saved).status()).toBe(status);
}

test("version provenance, comparison, unsaved navigation and two-tab conflict recovery", async ({ page, context, request }, testInfo) => {
  const seed = seedProject();
  const prefix = `/projects/${seed.projectId}/planning-results`;
  const original = await json<PlanningResult>(request, `${prefix}/latest`);
  const second = await context.newPage();
  await openProject(page, seed.projectId);
  await openProject(second, seed.projectId);
  const nodeSelector = `.react-flow__node[data-id="${original.nodes[0]!.id}"]`;
  await page.locator(nodeSelector).click();
  await second.locator(nodeSelector).click();
  await page.getByLabel("Node 이름", { exact: true }).fill("탭 A 편집");
  await second.getByLabel("Node 이름", { exact: true }).fill("탭 B 미저장 편집");
  await clickSave(page, 200);
  await expect(page.locator(".history-panel__origin")).toContainText("v2 · 사용자 편집본 · v1에서 편집");
  await page.locator(".version-comparison summary").click();
  await expect(page.locator(".version-change-list")).toContainText("탭 A 편집");
  await expect(page.locator(".version-change-list")).toContainText(original.nodes[0]!.label);

  await clickSave(second, 409);
  await expect(second.locator(".version-conflict")).toContainText("현재 화면은 유지됩니다");
  await expect(second.getByLabel("Node 이름", { exact: true })).toHaveValue("탭 B 미저장 편집");
  await expect(second.locator(".version-change-list")).toContainText("탭 A 편집");
  await expect(second.locator(".version-change-list")).toContainText("탭 B 미저장 편집");
  expect(await json<PlanningResultHistoryItem[]>(request, prefix)).toHaveLength(2);

  second.once("dialog", (dialog) => dialog.dismiss());
  await second.getByLabel("계획 버전", { exact: true }).selectOption(seed.resultId);
  await expect(second.getByLabel("Node 이름", { exact: true })).toHaveValue("탭 B 미저장 편집");
  second.once("dialog", (dialog) => dialog.accept());
  const resolved = second.waitForResponse((response) => response.url().endsWith("/edit"));
  await second.getByRole("button", { name: "내 편집본으로 새 버전 저장", exact: true }).click();
  expect((await resolved).status()).toBe(200);
  await expect(second.locator(".version-conflict")).toHaveCount(0);
  await expect(second.getByLabel("계획 버전", { exact: true }).locator("option")).toHaveCount(3);

  // The other tab remains stale; discarding its draft must load the committed head.
  await page.getByLabel("Node 이름", { exact: true }).fill("버릴 편집본");
  await clickSave(page, 409);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "최신 버전 불러오기", exact: true }).click();
  await page.locator(nodeSelector).click();
  await expect(page.getByLabel("Node 이름", { exact: true })).toHaveValue("탭 B 미저장 편집");

  // A restore also checks the head instead of silently replacing a newer version.
  await second.getByLabel("계획 버전", { exact: true }).selectOption(seed.resultId);
  const history = await json<PlanningResultHistoryItem[]>(request, prefix);
  const external = await json<PlanningResult>(request, `${prefix}/latest`);
  external.nodes[0]!.label = "복원 전에 저장한 버전";
  const externalSave = await request.post(`${api}${prefix}/${history[0]!.id}/edit`, { data: { nodes: external.nodes, roadmap: external.roadmap, expectedLatestResultId: history[0]!.id } });
  expect(externalSave.ok()).toBeTruthy();
  second.once("dialog", (dialog) => dialog.accept());
  const restoreConflict = second.waitForResponse((response) => response.url().endsWith("/restore"));
  await second.getByRole("button", { name: "이 버전 복원", exact: true }).click();
  expect((await restoreConflict).status()).toBe(409);
  await expect(second.locator(".version-conflict")).toContainText("복원을 중단");
  await expect(second.getByLabel("1단계 제목", { exact: true })).toHaveValue(original.roadmap[0]!.title);
  second.once("dialog", (dialog) => dialog.accept());
  const restored = second.waitForResponse((response) => response.url().endsWith("/restore"));
  await second.getByRole("button", { name: "이 버전 복원", exact: true }).click();
  expect((await restored).status()).toBe(200);
  await expect(second.locator(".history-panel__origin")).toContainText("v5 · 복원본 · v1에서 복원");
  expect((await json<PlanningResult>(request, `${prefix}/latest`)).nodes).toEqual(original.nodes);
  expect(await json<PlanningResult>(request, `${prefix}/${seed.resultId}`)).toEqual(original);
  await second.locator(".version-comparison summary").click();
  await second.getByLabel("비교 기준 버전", { exact: true }).selectOption(history[0]!.id);
  await expect(second.locator(".version-change-list")).toContainText("탭 B 미저장 편집");
  await testInfo.attach("version-workspace", { body: await second.screenshot({ fullPage: true }), contentType: "image/png" });
  await second.close();
});

test("PostgreSQL serializes simultaneous saves against the same head", async ({ request }) => {
  const seed = seedProject();
  const prefix = `/projects/${seed.projectId}/planning-results`;
  const original = await json<PlanningResult>(request, `${prefix}/latest`);
  const responses = await Promise.all(["writer A", "writer B"].map((label) => request.post(`${api}${prefix}/${seed.resultId}/edit`, {
    data: { nodes: original.nodes.map((node, index) => index === 0 ? { ...node, label } : node), roadmap: original.roadmap, expectedLatestResultId: seed.resultId },
  })));
  expect(responses.map((response) => response.status()).sort()).toEqual([200, 409]);
  expect(await json<PlanningResultHistoryItem[]>(request, prefix)).toHaveLength(2);
  expect(await json<PlanningResult>(request, `${prefix}/${seed.resultId}`)).toEqual(original);
});
