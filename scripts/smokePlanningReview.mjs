import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const baseUrl = (process.env.PLANNING_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
const evidencePath = "build/local-runtime/planning-review-smoke.json";
const evidence = { startedAt: new Date().toISOString(), projectId: null, review: null, generations: [] };

async function request(path, body) {
  const response = await fetch(`${baseUrl}${path}`, body === undefined ? undefined : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
  return response.json();
}

try {
  const catalog = await request("/planning/models");
  const project = await request("/projects", { title: `Review AI Smoke ${evidence.startedAt}` });
  evidence.projectId = project.id;
  const prefix = `/projects/${project.id}`;
  const reviewed = await request(`${prefix}/planning-reviews`, {
    idempotencyKey: randomUUID(),
    input: { requirement: "이번 주 토요일 오전에 책상을 정리하는 계획을 만들어 주세요.", preference: "balanced", brief: {
      planType: "daily", successCriterion: "clarity", context: ["혼자 사용하는 집의 책상"],
      actionItems: [{ title: "불필요한 종이를 분류하고 책상 표면을 청소하기", necessity: "required" }],
      constraints: "오전 10시부터 11시까지 1시간, 새 물건은 구매하지 않음",
    } },
  });
  evidence.review = reviewed;
  console.log(JSON.stringify({ phase: "review", status: reviewed.run.status, model: reviewed.run.requestedModel,
    usage: reviewed.run.usage, errorCode: reviewed.run.errorCode }));
  if (reviewed.run.status !== "succeeded") throw new Error("Live input review did not succeed.");
  const models = process.argv.includes("--all-models") ? catalog.models.map((model) => model.id) : [catalog.defaultModel];
  for (const model of models) {
    const confirmation = await request(`${prefix}/planning-reviews/${reviewed.review.id}/decisions`, {
      kind: "confirmation", inputHash: reviewed.review.inputHash, selectedModel: model,
      acceptedAssumptions: true, idempotencyKey: randomUUID(),
    });
    const generated = await request(`${prefix}/planning-confirmations/${confirmation.id}/generate`, { idempotencyKey: randomUUID() });
    evidence.generations.push(generated);
    console.log(JSON.stringify({ phase: "generation", model, status: generated.run.status,
      resultId: generated.run.resultId, usage: generated.run.usage, errorCode: generated.run.errorCode }));
    if (generated.run.status !== "succeeded") process.exitCode = 1;
    if (generated.run.status === "succeeded") {
      const latest = await request(`${prefix}/planning-results/latest`);
      if (latest.metadata.resultId !== generated.result.metadata.resultId) throw new Error("Latest DB result mismatch.");
    }
  }
} catch (error) {
  evidence.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  evidence.finishedAt = new Date().toISOString();
  await mkdir("build/local-runtime", { recursive: true });
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2), "utf8");
  console.log(`Smoke evidence: ${evidencePath}`);
}
