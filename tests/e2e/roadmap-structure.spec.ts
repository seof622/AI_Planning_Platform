import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import type { PlanningResult } from "@ai-planning-platform/shared";

test("roadmap structure, dependency ordering, reference cleanup and empty roadmap persist", async ({ page, request }, testInfo) => {
  const seed = JSON.parse(execFileSync("docker", ["compose", "exec", "-T", "api", "uv", "run", "--frozen", "python", "-m", "scripts.seed_editing_e2e"], { encoding: "utf8", timeout: 30_000 }).trim());
  const prefix = `http://localhost:8000/projects/${seed.projectId}/planning-results`;
  const original: PlanningResult = await (await request.get(`${prefix}/latest`)).json();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const panel = page.getByRole("region", { name: "계획 로드맵" });
  const card = (id: string) => panel.locator(`.roadmap-step[data-step-id="${id}"]`);
  async function open() {
    await page.goto("/");
    await expect(page.getByLabel("프로젝트", { exact: true })).toBeEnabled();
    await page.getByLabel("프로젝트", { exact: true }).selectOption(seed.projectId);
    await expect(panel.getByRole("button", { name: "단계 추가", exact: true })).toBeEnabled();
  }
  async function save() {
    const response = page.waitForResponse((item) => item.url().endsWith("/edit") && item.request().method() === "POST");
    await panel.getByRole("button", { name: "변경 내용을 새 버전으로 저장", exact: true }).click();
    const saved = await response;
    expect(saved.status()).toBe(200);
    await expect(panel.getByRole("button", { name: "변경 내용을 새 버전으로 저장", exact: true })).toBeDisabled();
    return saved.json() as Promise<PlanningResult>;
  }
  await open();
  // Link a newly added Graph node to a newly added roadmap step in one version.
  await page.getByRole("button", { name: "노드 추가", exact: true }).click();
  await page.getByLabel("Node 이름", { exact: true }).fill("로드맵 연결 노드");
  await page.getByRole("button", { name: "Node 편집 닫기", exact: true }).click();
  await panel.getByRole("button", { name: "단계 추가", exact: true }).click();
  const addedCard = panel.locator(".roadmap-step").last();
  const addedId = (await addedCard.getAttribute("data-step-id"))!;
  await addedCard.getByLabel("5단계 제목", { exact: true }).fill("사용자 추가 단계");
  await addedCard.getByLabel("5단계 설명", { exact: true }).fill("새 Graph 노드와 연결한 실행 단계");
  await addedCard.locator("summary").filter({ hasText: "관련 노드" }).click();
  await addedCard.getByLabel("5단계 관련 노드: 로드맵 연결 노드", { exact: true }).check();
  await addedCard.locator("summary").filter({ hasText: "선행 단계" }).click();
  await addedCard.getByLabel(`5단계 선행 단계: ${original.roadmap[0]!.title}`, { exact: true }).check();
  // Reject a cycle without changing the draft or its order.
  const first = card(original.roadmap[0]!.id);
  await first.locator("summary").filter({ hasText: "선행 단계" }).click();
  await first.getByLabel("1단계 선행 단계: 사용자 추가 단계", { exact: true }).click();
  await expect(first.getByLabel("1단계 선행 단계: 사용자 추가 단계", { exact: true })).not.toBeChecked();
  await expect(panel.getByRole("alert")).toContainText("순환 의존성");
  // Choosing a later prerequisite automatically sorts the roadmap.
  const third = card(original.roadmap[2]!.id);
  await third.locator("summary").filter({ hasText: "선행 단계" }).click();
  await third.getByLabel("3단계 선행 단계: 사용자 추가 단계", { exact: true }).check();
  await expect(card(addedId).getByLabel("3단계 제목", { exact: true })).toHaveValue("사용자 추가 단계");
  await testInfo.attach("roadmap-reference-editor", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  const added = await save();
  expect(added.roadmap.map((step) => step.id)).toEqual([original.roadmap[0]!.id, original.roadmap[1]!.id, addedId, original.roadmap[2]!.id, original.roadmap[3]!.id]);
  const linkedNode = added.nodes.find((node) => node.label === "로드맵 연결 노드")!;
  expect(added.roadmap[2]!.componentNodeIds).toEqual([linkedNode.id]);
  await open();
  await card(addedId).locator("summary").filter({ hasText: "관련 노드" }).click();
  await expect(card(addedId).getByLabel("3단계 관련 노드: 로드맵 연결 노드", { exact: true })).toBeChecked();
  // Unlink and relink nodes before saving; both operations must work.
  await card(addedId).getByLabel("3단계 관련 노드: 로드맵 연결 노드", { exact: true }).uncheck();
  await card(addedId).getByLabel("3단계 관련 노드: 로드맵 연결 노드", { exact: true }).check();
  // Cancel deletion first, then confirm and detach dependent references.
  page.once("dialog", (dialog) => dialog.dismiss());
  await first.getByRole("button", { name: `${original.roadmap[0]!.title} 단계 삭제`, exact: true }).click();
  await expect(panel.locator(".roadmap-step")).toHaveCount(5);
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("사용자 추가 단계");
    await dialog.accept();
  });
  await first.getByRole("button", { name: `${original.roadmap[0]!.title} 단계 삭제`, exact: true }).click();
  const deleted = await save();
  expect(deleted.roadmap.map((step) => step.order)).toEqual([1, 2, 3, 4]);
  expect(deleted.roadmap.every((step) => !step.dependsOn.includes(original.roadmap[0]!.id))).toBe(true);
  await open();
  await expect(panel.locator(".roadmap-step")).toHaveCount(4);
  while (await panel.locator(".roadmap-step").count()) {
    page.once("dialog", (dialog) => dialog.accept());
    await panel.locator(".roadmap-step").first().getByRole("button", { name: /단계 삭제$/ }).click();
  }
  await expect(panel).toContainText("단계가 없습니다");
  expect((await save()).roadmap).toEqual([]);
  await open();
  await expect(panel).toContainText("단계가 없습니다");
  await panel.getByRole("button", { name: "단계 추가", exact: true }).click();
  await expect(panel.getByLabel("1단계 제목", { exact: true })).toHaveValue("새 단계");
  expect((await save()).roadmap).toHaveLength(1);
  await page.getByLabel("계획 버전", { exact: true }).selectOption(seed.resultId);
  page.once("dialog", (dialog) => dialog.accept());
  const restored = page.waitForResponse((item) => item.url().endsWith("/restore"));
  await page.getByRole("button", { name: "이 버전 복원", exact: true }).click();
  expect((await restored).status()).toBe(200);
  expect((await (await request.get(`${prefix}/latest`)).json()).roadmap).toEqual(original.roadmap);
  expect(await (await request.get(`${prefix}/${seed.resultId}`)).json()).toEqual(original);
  expect(errors).toEqual([]);
});
