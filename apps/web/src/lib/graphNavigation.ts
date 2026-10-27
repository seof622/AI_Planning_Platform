import type { ComponentNode } from "@ai-planning-platform/shared";

export type NodeTypeFilter = ComponentNode["type"] | "all";
export interface NodeFocusRequest { nodeId: string; revision: number; sequence: number }

export function filterGraphNodes(nodes: ComponentNode[], query: string, type: NodeTypeFilter): ComponentNode[] {
  const needle = query.normalize("NFKC").trim().toLowerCase();
  return nodes.filter((node) => (type === "all" || node.type === type)
    && node.label.normalize("NFKC").toLowerCase().includes(needle));
}
