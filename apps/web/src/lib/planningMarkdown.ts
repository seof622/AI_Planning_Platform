import type { PlanningResult } from "@ai-planning-platform/shared";
import { dependencyLabels, effortLabels, nodeTypeLabels, priorityLabels } from "./planningLabels";

export interface PlanningMarkdownOptions {
  result: PlanningResult;
  projectTitle?: string;
  version?: string;
  hasUnsavedEdits?: boolean;
}

// Treat user and AI text as literal content, including HTML and Markdown syntax.
function inline(value: string): string {
  return value.replace(/\r\n|\r|\n/g, " ")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/[\\`*_{}\[\]()#+.!|~\-]/g, "\\$&");
}

function paragraph(value: string): string {
  return value.trim().split(/\r\n|\r|\n/).map((line) => inline(line.trim())).join("  \n") || "없음";
}

export function createPlanningMarkdown({ result, projectTitle, version, hasUnsavedEdits = false }: PlanningMarkdownOptions): string {
  const title = projectTitle?.trim() || result.project?.title || "계획";
  const lines = [
    `# ${inline(title)}`,
    "",
    ...(version ? [`- 버전: ${inline(version)}`] : []),
    `- 편집 상태: ${hasUnsavedEdits ? "저장 전 편집 포함" : "저장된 결과"}`,
    `- 결과 생성 시각: ${inline(result.metadata.generatedAt)}`,
    ...(result.metadata.model ? [`- 생성 모델: ${inline(result.metadata.model)}`] : []),
    "",
    "## 요구사항", "", paragraph(result.requirement?.content ?? ""), "",
    "## 요약", "", paragraph(result.summary), "",
    "## 구성 노드", "",
  ];
  const nodeNames = new Map(result.nodes.map((node, index) => [node.id, `${index + 1}. ${node.label}`]));
  for (const [index, node] of result.nodes.entries()) {
    lines.push(`### ${index + 1}. ${inline(node.label)}`, "",
      `- 유형: ${nodeTypeLabels[node.type]}`,
      `- 분류: ${inline(node.category) || "없음"}`,
      `- 우선순위: ${priorityLabels[node.priority]}`, "", paragraph(node.description), "");
  }
  if (!result.nodes.length) lines.push("구성 노드가 없습니다.", "");

  lines.push("## 노드 연결", "");
  if (result.edges.length) {
    lines.push("| 시작 노드 | 관계 | 대상 노드 | 설명 |", "| --- | --- | --- | --- |");
    for (const edge of result.edges) {
      lines.push(`| ${inline(nodeNames.get(edge.source) ?? edge.source)} | ${dependencyLabels[edge.dependencyType]} | ${inline(nodeNames.get(edge.target) ?? edge.target)} | ${inline(edge.label)} |`);
    }
    lines.push("");
  } else lines.push("노드 연결이 없습니다.", "");

  lines.push("## 실행 로드맵", "");
  const steps = [...result.roadmap].sort((a, b) => a.order - b.order);
  const stepNames = new Map(steps.map((step) => [step.id, `${step.order}. ${step.title}`]));
  const references = (ids: string[], names: Map<string, string>) => ids.map((id) => inline(names.get(id) ?? id)).join(", ") || "없음";
  for (const step of steps) {
    lines.push(`### ${step.order}. ${inline(step.title)}`, "",
      `- 우선순위: ${priorityLabels[step.priority]}`,
      `- 예상 작업량: ${effortLabels[step.estimatedEffort]}`,
      `- 선행 단계: ${references(step.dependsOn, stepNames)}`,
      `- 관련 노드: ${references(step.componentNodeIds ?? [], nodeNames)}`,
      "", paragraph(step.description), "");
  }
  if (!steps.length) lines.push("등록된 실행 단계가 없습니다.", "");
  return lines.join("\n");
}

export function planningMarkdownFilename({ result, projectTitle, version, hasUnsavedEdits }: PlanningMarkdownOptions): string {
  const safe = (value: string) => Array.from(value.normalize("NFC")
    .replace(/[<>:"/\\|?*]|\p{Cc}/gu, "-")
    .replace(/\s+/g, " ").replace(/^[ .]+|[ .]+$/g, "")).slice(0, 80).join("");
  const title = safe(projectTitle?.trim() || result.project?.title || "계획") || "계획";
  const versionPart = version ? safe(version) : "";
  return `${title}-계획${versionPart ? `-${versionPart}` : ""}${hasUnsavedEdits ? "-편집중" : ""}.md`;
}

export function downloadPlanningMarkdown(options: PlanningMarkdownOptions): void {
  const url = URL.createObjectURL(new Blob([createPlanningMarkdown(options)], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = planningMarkdownFilename(options);
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Allow the browser to consume the URL before releasing the download data.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
