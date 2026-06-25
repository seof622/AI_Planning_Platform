export type ISODateString = string;

export type Metadata = Record<string, unknown>;

export type ProjectStatus = "draft" | "generated" | "archived";

export type RequirementSource = "user" | "imported" | "ai_refined";

export type ComponentNodeType =
  | "feature"
  | "system"
  | "api"
  | "data"
  | "ai"
  | "infra"
  | "ui"
  | "workflow";

export type DependencyType = "requires" | "feeds" | "blocks" | "related";

export type Priority = "low" | "medium" | "high";

export type EffortSize = "small" | "medium" | "large";

export type PlanType =
  | "daily"
  | "project"
  | "learning"
  | "event"
  | "decision"
  | "creative";

export type SuccessCriterion =
  | "clarity"
  | "speed"
  | "balance"
  | "quality"
  | "consistency";

export type ActionItemNecessity = "required" | "optional";

export interface PlanningActionItem {
  title: string;
  necessity: ActionItemNecessity;
}

export interface TimestampFields {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Project extends TimestampFields {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
}

export interface Requirement extends TimestampFields {
  id: string;
  projectId: string;
  content: string;
  source: RequirementSource;
  priority: Priority;
}

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface ComponentNode {
  id: string;
  type: ComponentNodeType;
  label: string;
  description: string;
  category: string;
  priority: Priority;
  position: CanvasPosition;
  metadata?: Metadata;
}

export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  dependencyType: DependencyType;
  metadata?: Metadata;
}

export interface RoadmapStep {
  id: string;
  title: string;
  description: string;
  order: number;
  priority: Priority;
  estimatedEffort: EffortSize;
  dependsOn: string[];
  componentNodeIds?: string[];
}

export interface PlanningBrief {
  actionItems: PlanningActionItem[];
  context: string[];
  planType: PlanType;
  successCriterion: SuccessCriterion;
  constraints?: string;
}

export interface PlanningRequest {
  requirement: string;
  brief?: PlanningBrief;
  project?: Pick<Project, "id" | "title" | "description">;
  options?: {
    includeRoadmap?: boolean;
    preferredNodeTypes?: ComponentNodeType[];
  };
  metadata?: Metadata;
}

export interface PlanningResultMetadata extends Metadata {
  generatedAt: ISODateString;
  model?: string;
  workflowVersion?: string;
}

export interface PlanningResult {
  project?: Project;
  requirement?: Requirement;
  nodes: ComponentNode[];
  edges: DependencyEdge[];
  roadmap: RoadmapStep[];
  summary: string;
  metadata: PlanningResultMetadata;
}

export function isPlanningResultGraphConsistent(result: PlanningResult): boolean {
  const nodeIds = new Set(result.nodes.map((node) => node.id));

  return result.edges.every(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
  );
}
