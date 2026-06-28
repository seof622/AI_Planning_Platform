import type {
  ComponentNodeType,
  DependencyType,
  EffortSize,
  PlanningRequest,
  PlanningResult,
  Priority,
  RoadmapStep,
} from "./types.js";

export interface ContractValidationIssue {
  path: string;
  message: string;
}

export interface ContractValidationResult {
  valid: boolean;
  issues: ContractValidationIssue[];
}

const componentNodeTypes = new Set<ComponentNodeType>([
  "feature",
  "system",
  "api",
  "data",
  "ai",
  "infra",
  "ui",
  "workflow",
]);

const dependencyTypes = new Set<DependencyType>([
  "requires",
  "feeds",
  "blocks",
  "related",
]);

const priorities = new Set<Priority>(["low", "medium", "high"]);
const effortSizes = new Set<EffortSize>(["small", "medium", "large"]);

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function addIssue(
  issues: ContractValidationIssue[],
  path: string,
  message: string,
) {
  issues.push({ path, message });
}

function findDuplicateIds(items: Array<{ id: string }>): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) {
      duplicates.add(item.id);
    }

    seen.add(item.id);
  }

  return [...duplicates];
}

export function validatePlanningRequest(
  request: PlanningRequest,
): ContractValidationResult {
  const issues: ContractValidationIssue[] = [];

  if (!hasText(request.requirement)) {
    addIssue(issues, "requirement", "Requirement must not be empty.");
  }

  request.brief?.actionItems.forEach((item, index) => {
    if (!hasText(item.title)) {
      addIssue(
        issues,
        `brief.actionItems.${index}.title`,
        "Action item title must not be empty.",
      );
    }
  });

  request.brief?.context.forEach((item, index) => {
    if (!hasText(item)) {
      addIssue(
        issues,
        `brief.context.${index}`,
        "Context item must not be empty.",
      );
    }
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validatePlanningResult(
  result: PlanningResult,
): ContractValidationResult {
  const issues: ContractValidationIssue[] = [];
  const nodeIds = new Set(result.nodes.map((node) => node.id));
  const roadmapStepIds = new Set(result.roadmap.map((step) => step.id));

  if (result.nodes.length === 0) {
    addIssue(issues, "nodes", "Planning result should contain at least one node.");
  }

  if (result.roadmap.length === 0) {
    addIssue(
      issues,
      "roadmap",
      "Planning result should contain at least one roadmap step.",
    );
  }

  if (!hasText(result.summary)) {
    addIssue(issues, "summary", "Summary must not be empty.");
  }

  if (!hasText(result.metadata.generatedAt)) {
    addIssue(
      issues,
      "metadata.generatedAt",
      "Metadata generatedAt must not be empty.",
    );
  }

  for (const id of findDuplicateIds(result.nodes)) {
    addIssue(issues, "nodes", `Duplicate node id: ${id}.`);
  }

  result.nodes.forEach((node, index) => {
    const path = `nodes.${index}`;

    if (!hasText(node.id)) {
      addIssue(issues, `${path}.id`, "Node id must not be empty.");
    }

    if (!componentNodeTypes.has(node.type)) {
      addIssue(issues, `${path}.type`, `Unsupported node type: ${node.type}.`);
    }

    if (!hasText(node.label)) {
      addIssue(issues, `${path}.label`, "Node label must not be empty.");
    }

    if (!hasText(node.description)) {
      addIssue(
        issues,
        `${path}.description`,
        "Node description must not be empty.",
      );
    }

    if (!priorities.has(node.priority)) {
      addIssue(
        issues,
        `${path}.priority`,
        `Unsupported node priority: ${node.priority}.`,
      );
    }

    if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) {
      addIssue(
        issues,
        `${path}.position`,
        "Node position must contain finite x and y values.",
      );
    }
  });

  for (const id of findDuplicateIds(result.edges)) {
    addIssue(issues, "edges", `Duplicate edge id: ${id}.`);
  }

  result.edges.forEach((edge, index) => {
    const path = `edges.${index}`;

    if (!hasText(edge.id)) {
      addIssue(issues, `${path}.id`, "Edge id must not be empty.");
    }

    if (!nodeIds.has(edge.source)) {
      addIssue(
        issues,
        `${path}.source`,
        `Edge source does not exist: ${edge.source}.`,
      );
    }

    if (!nodeIds.has(edge.target)) {
      addIssue(
        issues,
        `${path}.target`,
        `Edge target does not exist: ${edge.target}.`,
      );
    }

    if (edge.source === edge.target) {
      addIssue(
        issues,
        path,
        "Self-referencing edges are not allowed in the current contract.",
      );
    }

    if (!dependencyTypes.has(edge.dependencyType)) {
      addIssue(
        issues,
        `${path}.dependencyType`,
        `Unsupported dependency type: ${edge.dependencyType}.`,
      );
    }
  });

  for (const id of findDuplicateIds(result.roadmap)) {
    addIssue(issues, "roadmap", `Duplicate roadmap step id: ${id}.`);
  }

  validateRoadmapSteps(result.roadmap, roadmapStepIds, nodeIds, issues);

  return {
    valid: issues.length === 0,
    issues,
  };
}

function validateRoadmapSteps(
  roadmap: RoadmapStep[],
  roadmapStepIds: Set<string>,
  nodeIds: Set<string>,
  issues: ContractValidationIssue[],
) {
  const seenOrders = new Set<number>();

  roadmap.forEach((step, index) => {
    const path = `roadmap.${index}`;

    if (!hasText(step.id)) {
      addIssue(issues, `${path}.id`, "Roadmap step id must not be empty.");
    }

    if (!hasText(step.title)) {
      addIssue(issues, `${path}.title`, "Roadmap step title must not be empty.");
    }

    if (!hasText(step.description)) {
      addIssue(
        issues,
        `${path}.description`,
        "Roadmap step description must not be empty.",
      );
    }

    if (!Number.isInteger(step.order) || step.order < 1) {
      addIssue(
        issues,
        `${path}.order`,
        "Roadmap step order must be a positive integer.",
      );
    }

    if (seenOrders.has(step.order)) {
      addIssue(issues, `${path}.order`, `Duplicate roadmap order: ${step.order}.`);
    }

    seenOrders.add(step.order);

    if (!priorities.has(step.priority)) {
      addIssue(
        issues,
        `${path}.priority`,
        `Unsupported roadmap priority: ${step.priority}.`,
      );
    }

    if (!effortSizes.has(step.estimatedEffort)) {
      addIssue(
        issues,
        `${path}.estimatedEffort`,
        `Unsupported estimated effort: ${step.estimatedEffort}.`,
      );
    }

    step.dependsOn.forEach((dependencyId, dependencyIndex) => {
      if (!roadmapStepIds.has(dependencyId)) {
        addIssue(
          issues,
          `${path}.dependsOn.${dependencyIndex}`,
          `Roadmap dependency does not exist: ${dependencyId}.`,
        );
      }
    });

    step.componentNodeIds?.forEach((nodeId, nodeIndex) => {
      if (!nodeIds.has(nodeId)) {
        addIssue(
          issues,
          `${path}.componentNodeIds.${nodeIndex}`,
          `Roadmap component node does not exist: ${nodeId}.`,
        );
      }
    });
  });
}
