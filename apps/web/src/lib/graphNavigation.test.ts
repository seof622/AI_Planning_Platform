import { describe, expect, it } from "vitest";
import { mockPlanningResult } from "@ai-planning-platform/shared";
import { filterGraphNodes } from "./graphNavigation";

describe("filterGraphNodes", () => {
  it("normalizes name search while combining it with the requested type", () => {
    const nodes = mockPlanningResult.nodes;
    expect(filterGraphNodes(nodes, "  ＡＰＩ  ", "api").map((node) => node.id)).toEqual(["node-planning-api"]);
    expect(filterGraphNodes(nodes, "api", "ui")).toEqual([]);
    expect(filterGraphNodes(nodes, "", "ui").map((node) => node.id)).toEqual(["node-requirement-input", "node-graph-canvas"]);
    expect(filterGraphNodes(nodes, "  ", "all")).toEqual(nodes);
  });
  it("returns duplicate names by ID and uses the current edited labels without changing the graph", () => {
    const source = structuredClone(mockPlanningResult.nodes);
    const duplicate = { ...source[0]!, id: "duplicate" };
    const nodes = [...source, duplicate];
    const before = structuredClone(nodes);
    expect(filterGraphNodes(nodes, source[0]!.label, "all").map((node) => node.id)).toEqual([source[0]!.id, "duplicate"]);
    expect(filterGraphNodes(nodes.map((node) => node.id === "duplicate" ? { ...node, label: "Updated" } : node), "updated", "all").map((node) => node.id)).toEqual(["duplicate"]);
    expect(nodes).toEqual(before);
  });
});
