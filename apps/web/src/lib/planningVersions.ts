import type { PlanningResult, PlanningResultHistoryItem } from "@ai-planning-platform/shared";
import { effortLabels, nodeTypeLabels, priorityLabels } from "./planningLabels";

export function versionOrigin(item: PlanningResultHistoryItem): string {
  if (item.restoredFromResultId) return "복원본";
  if (item.editedFromResultId) return "사용자 편집본";
  return item.model === "mock" ? "목업 원본" : "AI 생성 원본";
}

export function versionLabel(history: PlanningResultHistoryItem[], id: string): string {
  const index = history.findIndex((item) => item.id === id);
  return index < 0 ? "이전 기록" : `v${history.length - index}`;
}

export interface VersionChange {
  group: string;
  item: string;
  field: string;
  before: string;
  after: string;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

function displayValue(value: unknown, field: string, result: PlanningResult): string {
  if (value === undefined || value === null || value === "") return "없음";
  if (field === "source" || field === "target") return result.nodes.find((node) => node.id === value)?.label ?? "없는 노드";
  if (Array.isArray(value) && field === "componentNodeIds") return value.map((id) => result.nodes.find((node) => node.id === id)?.label ?? "없는 노드").join(", ") || "없음";
  if (Array.isArray(value) && field === "dependsOn") return value.map((id) => result.roadmap.find((step) => step.id === id)?.title ?? "없는 단계").join(", ") || "없음";
  if (field === "priority") return priorityLabels[value as keyof typeof priorityLabels];
  if (field === "estimatedEffort") return effortLabels[value as keyof typeof effortLabels];
  if (field === "type") return nodeTypeLabels[value as keyof typeof nodeTypeLabels];
  return typeof value === "object" ? JSON.stringify(stableValue(value)) : String(value);
}

export function comparePlanningResults(before: PlanningResult, after: PlanningResult): VersionChange[] {
  const changes: VersionChange[] = [];
  function field(group: string, item: string, key: string, label: string, previous: unknown, current: unknown) {
    if (JSON.stringify(stableValue(previous)) === JSON.stringify(stableValue(current))) return;
    changes.push({ group, item, field: label, before: displayValue(previous, key, before), after: displayValue(current, key, after) });
  }
  function collection<T extends { id: string }>(
    group: string, previous: T[], current: T[], title: (item: T) => string,
    fields: [keyof T & string, string][],
  ) {
    const oldItems = new Map(previous.map((item) => [item.id, item]));
    const newItems = new Map(current.map((item) => [item.id, item]));
    for (const id of new Set([...oldItems.keys(), ...newItems.keys()])) {
      const oldItem = oldItems.get(id);
      const newItem = newItems.get(id);
      if (!oldItem || !newItem) {
        changes.push({ group, item: title((newItem ?? oldItem)!), field: newItem ? "추가" : "삭제", before: oldItem ? title(oldItem) : "없음", after: newItem ? title(newItem) : "없음" });
        continue;
      }
      for (const [key, label] of fields) {
        const isSet = key === "dependsOn" || key === "componentNodeIds";
        const oldValue = isSet ? [...((oldItem[key] ?? []) as string[])].sort() : oldItem[key];
        const newValue = isSet ? [...((newItem[key] ?? []) as string[])].sort() : newItem[key];
        field(group, title(newItem), key, label, oldValue, newValue);
      }
    }
  }
  field("계획", "요약", "summary", "내용", before.summary, after.summary);
  field("계획", "요구사항", "content", "내용", before.requirement?.content, after.requirement?.content);
  collection("노드", before.nodes, after.nodes, (item) => item.label, [
    ["label", "이름"], ["description", "설명"], ["category", "분류"],
    ["type", "유형"], ["priority", "우선순위"], ["position", "위치"], ["metadata", "메타데이터"],
  ]);
  collection("연결", before.edges, after.edges, (item) => item.label, [
    ["label", "이름"], ["source", "시작 노드"], ["target", "대상 노드"], ["dependencyType", "관계"], ["metadata", "메타데이터"],
  ]);
  collection("로드맵", before.roadmap, after.roadmap, (item) => item.title, [
    ["title", "제목"], ["description", "설명"], ["order", "순서"],
    ["priority", "우선순위"], ["estimatedEffort", "작업량"],
    ["dependsOn", "선행 단계"], ["componentNodeIds", "관련 노드"],
  ]);
  return changes;
}
