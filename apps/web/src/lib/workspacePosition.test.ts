import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockPlanningResult } from "@ai-planning-platform/shared";
import { lastProjectKey, readLastProject, readWorkspacePosition, restoreWorkspacePosition, workspacePositionPrefix, writeLastProject, writeWorkspacePosition } from "./workspacePosition";

describe("workspace position persistence", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("isolates projects and merges selection changes without losing viewport or scroll", () => {
    writeWorkspacePosition("a", { resultId: "v1", viewport: { x: 200, y: -150, zoom: 0.7 }, roadmapScrollLeft: 650 });
    writeWorkspacePosition("a", { selectedNodeId: "node-a" });
    writeWorkspacePosition("b", { selectedStepId: "step-b" });
    expect(readWorkspacePosition("a")).toMatchObject({ selectedNodeId: "node-a", viewport: { x: 200, y: -150, zoom: 0.7 }, roadmapScrollLeft: 650 });
    expect(readWorkspacePosition("b")).toMatchObject({ selectedNodeId: null, selectedStepId: "step-b", viewport: null, roadmapScrollLeft: 0 });
  });

  it("ignores malformed storage and invalid coordinates", () => {
    for (const raw of ["broken", "null", "[]", '{"viewport":{"x":1,"y":2,"zoom":999},"roadmapScrollLeft":-20}',
      '{"viewport":{"x":"1","y":2,"zoom":1},"selectedNodeId":42}']) {
      localStorage.setItem(workspacePositionPrefix + "a", raw);
      expect(readWorkspacePosition("a")).toEqual({ resultId: null, selectedNodeId: null, selectedStepId: null, viewport: null, roadmapScrollLeft: 0 });
    }
  });

  it("validates selection against the latest result and resets the view for a different version", () => {
    const nodeId = mockPlanningResult.nodes[0]!.id;
    writeWorkspacePosition("a", { resultId: "v1", selectedNodeId: nodeId, selectedStepId: "deleted",
      viewport: { x: 800, y: 400, zoom: 1 }, roadmapScrollLeft: 500 });
    expect(restoreWorkspacePosition("a", mockPlanningResult, "v1")).toMatchObject({ selectedNodeId: nodeId, selectedStepId: null, roadmapScrollLeft: 500 });
    expect(restoreWorkspacePosition("a", mockPlanningResult, "v2")).toMatchObject({ selectedNodeId: nodeId, viewport: null, roadmapScrollLeft: 0 });
    expect(restoreWorkspacePosition("a", { ...mockPlanningResult, nodes: [] }, "v2")).toMatchObject({ selectedNodeId: null, selectedStepId: null });
    expect(restoreWorkspacePosition("a", null, null)).toMatchObject({ selectedNodeId: null, selectedStepId: null, viewport: null });
  });

  it("does not interrupt navigation when storage is blocked or full", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    expect(readLastProject()).toBeNull();
    expect(readWorkspacePosition("a").viewport).toBeNull();
    expect(() => writeLastProject("a")).not.toThrow();
    expect(() => writeWorkspacePosition("a", { roadmapScrollLeft: 5 })).not.toThrow();
  });

  it("remembers the last successfully opened project", () => {
    writeLastProject("b");
    expect(readLastProject()).toBe("b");
    expect(localStorage.getItem(lastProjectKey)).toBe("b");
  });
});
