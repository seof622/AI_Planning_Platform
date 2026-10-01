import { execFileSync } from "node:child_process";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const api = "http://localhost:8000";

async function readJson(request: APIRequestContext, path: string) {
  const response = await request.get(`${api}${path}`);
  expect(response.ok(), `${path}: ${response.status()}`).toBeTruthy();
  return response.json();
}

async function saveEdit(page: Page, buttonName: string) {
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/edit") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  await expect(page.getByRole("button", { name: buttonName, exact: true })).toBeDisabled();
  return response.json();
}

test("Graph and Roadmap edits persist as new versions through browser reload", async ({ page, request }, testInfo) => {
  const health = await readJson(request, "/health");
  expect(health.status).toBe("ok");
  const seed = JSON.parse(execFileSync("docker", [
    "compose", "exec", "-T", "api", "uv", "run", "--frozen",
    "python", "-m", "scripts.seed_editing_e2e",
  ], { encoding: "utf8", timeout: 30_000 }).trim());
  const prefix = `/projects/${seed.projectId}/planning-results`;
  const original = await readJson(request, `${prefix}/${seed.resultId}`);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const nodeId = original.nodes[0].id;
  const node = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
  const version = page.getByLabel("계획 버전", { exact: true });
  let graphResult: any;
  let graphVersion: string;
  let roadmapResult: any;
  let combinedResult: any;

  async function reloadProject() {
    await page.reload();
    await expect(page.getByLabel("프로젝트", { exact: true })).toBeEnabled();
    await page.getByLabel("프로젝트", { exact: true }).selectOption(seed.projectId);
    await expect(node).toBeVisible();
  }

  await page.goto("/");
  await expect(page.getByLabel("프로젝트", { exact: true })).toBeEnabled();
  await page.getByLabel("프로젝트", { exact: true }).selectOption(seed.projectId);
  await expect(node).toBeVisible();
  await expect(version.locator("option")).toHaveCount(1);

  await test.step("Edit node fields, drag, save and reload", async () => {
    await node.click();
    await page.getByLabel("Node 이름", { exact: true }).fill("브라우저 E2E 노드");
    await page.getByLabel("Node 설명", { exact: true }).fill("브라우저에서 수정한 설명");
    await page.getByLabel("Node 분류", { exact: true }).fill("E2E 검증");
    await page.getByLabel("Node 우선순위", { exact: true }).selectOption("low");
    const box = await node.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 30);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 70, box!.y + 65, { steps: 12 });
    await page.mouse.up();
    graphResult = await saveEdit(page, "편집본 새 버전 저장");
    const editedNode = graphResult.nodes.find((item: any) => item.id === nodeId);
    expect(editedNode).toMatchObject({
      label: "브라우저 E2E 노드", description: "브라우저에서 수정한 설명",
      category: "E2E 검증", priority: "low",
    });
    expect(editedNode.position.x).toBeGreaterThan(original.nodes[0].position.x);
    expect(editedNode.position.y).toBeGreaterThan(original.nodes[0].position.y);
    expect(graphResult.metadata.editedFromResultId).toBe(seed.resultId);
    await expect(version.locator("option")).toHaveCount(2);
    graphVersion = (await readJson(request, prefix))[0].id;
    await reloadProject();
    await node.click();
    await expect(page.getByLabel("Node 이름", { exact: true })).toHaveValue(editedNode.label);
    await expect(page.getByLabel("Node 설명", { exact: true })).toHaveValue(editedNode.description);
    await expect(page.getByLabel("Node 분류", { exact: true })).toHaveValue(editedNode.category);
    await expect(page.getByLabel("Node 우선순위", { exact: true })).toHaveValue(editedNode.priority);
    await expect(page.locator(".detail-drawer")).toContainText(`x ${editedNode.position.x}, y ${editedNode.position.y}`);
    expect((await readJson(request, `${prefix}/latest`)).nodes).toEqual(graphResult.nodes);
    await page.getByRole("button", { name: "Node 편집 닫기", exact: true }).click();
    await expect(page.getByLabel("Node 이름", { exact: true })).toHaveCount(0);
    await node.click();
  });

  await test.step("Reject dependency violation; save valid reorder and all Roadmap fields", async () => {
    const roadmap = page.getByRole("region", { name: "계획 로드맵" });
    await roadmap.getByRole("button", { name: `${original.roadmap[0].title} 뒤로 이동`, exact: true }).click();
    await expect(roadmap.getByRole("alert")).toHaveText("선행 단계보다 앞이나 같은 위치로 이동할 수 없습니다.");
    await expect(page.getByLabel("1단계 제목", { exact: true })).toHaveValue(original.roadmap[0].title);
    await expect(page.getByRole("button", { name: "로드맵 새 버전 저장", exact: true })).toBeDisabled();
    await roadmap.getByRole("button", { name: `${original.roadmap[1].title} 뒤로 이동`, exact: true }).click();
    await expect(page.getByLabel("2단계 제목", { exact: true })).toHaveValue(original.roadmap[2].title);
    await page.getByLabel("1단계 제목", { exact: true }).fill("브라우저 E2E 단계");
    await page.getByLabel("1단계 설명", { exact: true }).fill("브라우저에서 수정한 단계 설명");
    await page.getByLabel("1단계 우선순위", { exact: true }).selectOption("low");
    await page.getByLabel("1단계 예상 작업량", { exact: true }).selectOption("large");
    roadmapResult = await saveEdit(page, "로드맵 새 버전 저장");
    expect(roadmapResult.metadata.editedFromResultId).toBe(graphVersion);
    expect(roadmapResult.nodes).toEqual(graphResult.nodes);
    expect(roadmapResult.roadmap[0]).toMatchObject({
      title: "브라우저 E2E 단계", description: "브라우저에서 수정한 단계 설명",
      priority: "low", estimatedEffort: "large", order: 1,
    });
    expect(roadmapResult.roadmap.map((step: any) => step.id)).toEqual([
      original.roadmap[0].id, original.roadmap[2].id, original.roadmap[1].id, original.roadmap[3].id,
    ]);
    await expect(version.locator("option")).toHaveCount(3);
    await reloadProject();
    await expect(page.getByLabel("1단계 제목", { exact: true })).toHaveValue("브라우저 E2E 단계");
    await expect(page.getByLabel("1단계 설명", { exact: true })).toHaveValue("브라우저에서 수정한 단계 설명");
    await expect(page.getByLabel("1단계 우선순위", { exact: true })).toHaveValue("low");
    await expect(page.getByLabel("1단계 예상 작업량", { exact: true })).toHaveValue("large");
    await expect(page.getByLabel("2단계 제목", { exact: true })).toHaveValue(original.roadmap[2].title);
    expect((await readJson(request, `${prefix}/latest`)).roadmap).toEqual(roadmapResult.roadmap);
  });

  await test.step("Save Graph and Roadmap together without overwriting prior versions", async () => {
    await node.click();
    await page.getByLabel("Node 이름", { exact: true }).fill("동시 편집 노드");
    await page.getByLabel("1단계 제목", { exact: true }).fill("동시 편집 단계");
    combinedResult = await saveEdit(page, "로드맵 새 버전 저장");
    await expect(version.locator("option")).toHaveCount(4);
    await reloadProject();
    await node.click();
    await expect(page.getByLabel("Node 이름", { exact: true })).toHaveValue("동시 편집 노드");
    await expect(page.getByLabel("1단계 제목", { exact: true })).toHaveValue("동시 편집 단계");
    expect(await readJson(request, `${prefix}/${seed.resultId}`)).toEqual(original);
    expect(await readJson(request, `${prefix}/${graphVersion}`)).toEqual(graphResult);
    const history = await readJson(request, prefix);
    expect(history[0].editedFromResultId).toBe(history[1].id);
    expect(await readJson(request, `${prefix}/latest`)).toEqual(combinedResult);
  });

  await test.step("Select original and restore as a new version", async () => {
    await version.selectOption(seed.resultId);
    await expect(page.getByLabel("1단계 제목", { exact: true })).toHaveValue(original.roadmap[0].title);
    await node.click();
    await expect(page.getByLabel("Node 이름", { exact: true })).toHaveValue(original.nodes[0].label);
    page.once("dialog", (dialog) => dialog.accept());
    const restoreResponse = page.waitForResponse((response) => response.url().endsWith("/restore"));
    await page.getByRole("button", { name: "이 버전 복원", exact: true }).click();
    expect((await restoreResponse).ok()).toBeTruthy();
    await expect(version.locator("option")).toHaveCount(5);
    await reloadProject();
    await expect(page.getByLabel("1단계 제목", { exact: true })).toHaveValue(original.roadmap[0].title);
    await node.click();
    await expect(page.getByLabel("Node 이름", { exact: true })).toHaveValue(original.nodes[0].label);
    const latest = await readJson(request, `${prefix}/latest`);
    expect(latest.nodes).toEqual(original.nodes);
    expect(latest.roadmap).toEqual(original.roadmap);
    expect(latest.metadata.restoredFromResultId).toBe(seed.resultId);
    expect(await readJson(request, `${prefix}/${seed.resultId}`)).toEqual(original);
  });

  expect(errors).toEqual([]);
  await expect(page.locator(".detail-drawer--open")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await testInfo.attach("database-evidence", {
    body: JSON.stringify({ ...seed, history: await readJson(request, prefix) }, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach("final-workspace", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});
