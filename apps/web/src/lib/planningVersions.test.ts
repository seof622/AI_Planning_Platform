import { describe, expect, it } from "vitest";
import { mockPlanningResult } from "@ai-planning-platform/shared";
import { comparePlanningResults, versionOrigin } from "./planningVersions";

describe("planning version comparison", () => {
  it("shows field differences, additions and removals while ignoring storage timestamps", () => {
    const before = structuredClone(mockPlanningResult);
    const after = structuredClone(before);
    after.metadata.generatedAt = "2026-10-01T00:00:00Z";
    after.requirement!.updatedAt = "2026-10-01T00:00:00Z";
    after.nodes[0]!.priority = "low";
    after.nodes[0]!.position.x = 120;
    after.roadmap[0]!.estimatedEffort = "large";
    after.nodes.pop();
    after.edges.push({ ...after.edges[0]!, id: "new-edge", label: "새 연결" });
    const changes = comparePlanningResults(before, after);
    expect(changes).toHaveLength(5);
    expect(changes).toContainEqual(expect.objectContaining({ field: "우선순위", before: "높음", after: "낮음" }));
    expect(changes).toContainEqual(expect.objectContaining({ group: "노드", field: "삭제" }));
    expect(changes).toContainEqual(expect.objectContaining({ group: "연결", field: "추가" }));
    expect(comparePlanningResults(before, structuredClone(before))).toEqual([]);
  });

  it("does not treat dependency set order or metadata key order as content changes", () => {
    const before = structuredClone(mockPlanningResult);
    before.roadmap[0]!.componentNodeIds = ["a", "b"];
    before.nodes[0]!.metadata = { a: 1, b: 2 };
    const after = structuredClone(before);
    after.roadmap[0]!.componentNodeIds = ["b", "a"];
    after.nodes[0]!.metadata = { b: 2, a: 1 };
    expect(comparePlanningResults(before, after)).toEqual([]);
  });

  it("recognizes legacy restore provenance even when metadata once inherited an edit", () => {
    expect(versionOrigin({ id: "a", canRestore: true, summary: "", createdAt: "", editedFromResultId: "b", restoredFromResultId: "c" })).toBe("복원본");
  });
});
