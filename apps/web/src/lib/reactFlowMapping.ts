import type { CSSProperties } from "react";
import type { Edge, Node } from "@xyflow/react";
import type {
  ComponentNode,
  DependencyEdge,
  PlanningResult,
} from "@ai-planning-platform/shared";
import { dependencyColors, dependencyLabels, nodeTypeColors } from "./planningLabels";

export type PlanningNodeData = ComponentNode &
  Record<string, unknown> & {
  typeLabel: string;
  };

export type PlanningFlowNode = Node<PlanningNodeData, "componentNode">;

export function toReactFlowNodes(result: PlanningResult): PlanningFlowNode[] {
  return result.nodes.map((node) => ({
    id: node.id,
    type: "componentNode",
    position: node.position,
    data: {
      ...node,
      typeLabel: node.type,
    },
    style: {
      "--node-accent": nodeTypeColors[node.type].accent,
      "--node-border": nodeTypeColors[node.type].border,
      background: nodeTypeColors[node.type].background,
    } as CSSProperties,
  }));
}

export function toReactFlowEdges(result: PlanningResult): Edge[] {
  return result.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label || dependencyLabels[edge.dependencyType],
    animated: edge.dependencyType === "feeds",
    type: "labeledDependency",
    markerEnd: {
      type: "arrowclosed",
      color: dependencyColors[edge.dependencyType],
    },
    style: {
      stroke: dependencyColors[edge.dependencyType],
      strokeDasharray: getDependencyDash(edge),
      strokeWidth: edge.dependencyType === "blocks" ? 2.5 : 2,
    },
  }));
}

function getDependencyDash(edge: DependencyEdge): string | undefined {
  if (edge.dependencyType === "related") {
    return "5 5";
  }

  if (edge.dependencyType === "blocks") {
    return "8 4";
  }

  return undefined;
}
