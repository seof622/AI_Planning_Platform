import type { RoadmapStep } from "@ai-planning-platform/shared";

// Keep the current order whenever dependencies permit it.
export function sortRoadmapByDependencies(roadmap: RoadmapStep[]): RoadmapStep[] | null {
  const ids = new Set(roadmap.map((step) => step.id));
  if (ids.size !== roadmap.length || roadmap.some((step) =>
    new Set(step.dependsOn).size !== step.dependsOn.length ||
    step.dependsOn.some((id) => !ids.has(id) || id === step.id))) return null;
  const remaining = [...roadmap].sort((left, right) => left.order - right.order);
  const ordered: RoadmapStep[] = [];
  const completed = new Set<string>();
  while (remaining.length > 0) {
    const index = remaining.findIndex((step) => step.dependsOn.every((id) => completed.has(id)));
    if (index === -1) return null;
    const step = remaining.splice(index, 1)[0]!;
    completed.add(step.id);
    ordered.push({ ...step, order: ordered.length + 1 });
  }
  return ordered;
}
