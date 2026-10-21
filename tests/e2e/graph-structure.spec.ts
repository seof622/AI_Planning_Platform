import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import type { PlanningResult } from "@ai-planning-platform/shared";

test("graph additions and deletions persist, clean references and preserve original versions", async ({ page, request }, testInfo) => {
  const seed = JSON.parse(execFileSync("docker", ["compose", "exec", "-T", "api", "uv", "run", "--frozen", "python", "-m", "scripts.seed_editing_e2e"], { encoding: "utf8", timeout: 30_000 }).trim());
  const prefix = `http://localhost:8000/projects/${seed.projectId}/planning-results`;
  const original: PlanningResult = await (await request.get(`${prefix}/latest`)).json();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  async function openProject() {
    await page.goto("/");
    await expect(page.getByLabel("프로젝트", { exact: true })).toBeEnabled();
    await page.getByLabel("프로젝트", { exact: true }).selectOption(seed.projectId);
    await expect(page.getByRole("button", { name: "노드 추가", exact: true })).toBeEnabled();
  }
  async function save() {
    const saved = page.waitForResponse((response) => response.url().endsWith("/edit") && response.request().method() === "POST");
    await page.locator(".graph-edit-panel").getByRole("button", { name: "변경 내용을 새 버전으로 저장", exact: true }).click();
    const response = await saved;
    expect(response.status()).toBe(200);
    await expect(page.locator(".graph-edit-panel").getByRole("button", { name: "변경 내용을 새 버전으로 저장", exact: true })).toBeDisabled();
    return response.json() as Promise<PlanningResult>;
  }
  await openProject();
  await page.getByRole("button", { name: "노드 추가", exact: true }).click();
  await page.getByLabel("Node 이름", { exact: true }).fill("직접 추가한 데이터");
  await page.getByLabel("Node 유형", { exact: true }).selectOption("data");
  await page.getByLabel("Node 설명", { exact: true }).fill("브라우저에서 추가한 노드");
  await page.getByRole("button", { name: "Node 편집 닫기", exact: true }).click();
  const newId = await page.locator(".react-flow__node").filter({ hasText: "직접 추가한 데이터" }).getAttribute("data-id");
  expect(newId).toBeTruthy();
  await page.getByLabel("새 연결 유형", { exact: true }).selectOption("feeds");
  async function dragBetween(source: ReturnType<typeof page.locator>, target: ReturnType<typeof page.locator>) {
    await target.scrollIntoViewIfNeeded();
    await source.scrollIntoViewIfNeeded();
    const from = await source.boundingBox();
    const to = await target.boundingBox();
    expect(from).not.toBeNull();
    expect(to).not.toBeNull();
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 25 });
    await page.mouse.up();
  }
  const sourceHandle = page.locator(`.react-flow__node[data-id="${original.nodes[0]!.id}"] .react-flow__handle.source`);
  const targetHandle = page.locator(`.react-flow__node[data-id="${newId}"] .react-flow__handle.target`);
  await dragBetween(sourceHandle, targetHandle);
  const addedLabel = page.getByRole("button", { name: "연결 선택: 전달", exact: true });
  await expect(addedLabel).toBeVisible();
  const edgeId = await addedLabel.getAttribute("data-edge-id");
  // Dragging the same connection again must not add a duplicate.
  await dragBetween(sourceHandle, targetHandle);
  await expect(addedLabel).toHaveCount(1);
  // Changing the type must not allow another edge between the same endpoints.
  await page.getByLabel("새 연결 유형", { exact: true }).selectOption("related");
  await dragBetween(sourceHandle, targetHandle);
  await expect(page.getByRole("button", { name: "연결 선택: 관련", exact: true })).toHaveCount(0);
  await expect(page.locator(".edge-label")).toHaveCount(original.edges.length + 1);
  await addedLabel.click();
  await page.getByLabel("선택한 연결 유형", { exact: true }).selectOption("related");
  await expect(page.getByRole("button", { name: "연결 선택: 관련", exact: true })).toBeVisible();
  // Change the existing target by dragging the selected edge's endpoint.
  const updater = page.locator(`.react-flow__edge[data-id="${edgeId}"] .react-flow__edgeupdater-target`);
  const replacement = page.locator(`.react-flow__node[data-id="${original.nodes[2]!.id}"] .react-flow__handle.target`);
  await dragBetween(updater, replacement);
  // Reconnecting onto an occupied pair is also rejected, even with a different type.
  const occupiedTarget = page.locator(`.react-flow__node[data-id="${original.nodes[1]!.id}"] .react-flow__handle.target`);
  await dragBetween(updater, occupiedTarget);
  await expect(page.getByLabel("선택한 연결 유형", { exact: true })).toHaveValue("related");
  await testInfo.attach("drag-connection-editor", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  const added = await save();
  expect(added.nodes).toHaveLength(original.nodes.length + 1);
  expect(added.nodes.find((node) => node.id === newId)?.type).toBe("data");
  expect(added.edges).toHaveLength(original.edges.length + 1);
  expect(added.edges).toContainEqual(expect.objectContaining({ id: edgeId, source: original.nodes[0]!.id, target: original.nodes[2]!.id, dependencyType: "related" }));
  await openProject();
  await page.locator(`.edge-label[data-edge-id="${edgeId}"]`).click();
  await page.getByRole("button", { name: "연결 삭제", exact: true }).click();
  const edgeRemoved = await save();
  expect(edgeRemoved.edges).toEqual(original.edges);
  const removedNodeId = original.nodes[0]!.id;
  await page.locator(`.react-flow__node[data-id="${removedNodeId}"]`).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "노드 삭제", exact: true }).click();
  await expect(page.getByLabel("Node 이름", { exact: true })).toHaveValue(original.nodes[0]!.label);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "노드 삭제", exact: true }).click();
  await expect(page.getByLabel("Node 이름", { exact: true })).toHaveCount(0);
  const removed = await save();
  expect(removed.nodes.some((node) => node.id === removedNodeId)).toBe(false);
  expect(removed.edges.every((edge) => edge.source !== removedNodeId && edge.target !== removedNodeId)).toBe(true);
  expect(removed.roadmap.every((step) => !step.componentNodeIds?.includes(removedNodeId))).toBe(true);
  await openProject();
  await expect(page.locator(`.react-flow__node[data-id="${removedNodeId}"]`)).toHaveCount(0);
  await expect(page.locator(`.react-flow__node[data-id="${newId}"]`)).toBeVisible();
  expect(await (await request.get(`${prefix}/${seed.resultId}`)).json()).toEqual(original);
  expect(await (await request.get(`${prefix}/latest`)).json()).toEqual(removed);
  await page.getByLabel("계획 버전", { exact: true }).selectOption(seed.resultId);
  await expect(page.locator(`.react-flow__node[data-id="${removedNodeId}"]`)).toBeVisible();
  await expect(page.locator(`.react-flow__node[data-id="${newId}"]`)).toHaveCount(0);
  expect(errors).toEqual([]);
  await testInfo.attach("graph-structure-workspace", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});
