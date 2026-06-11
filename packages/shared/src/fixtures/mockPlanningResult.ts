import type { PlanningResult } from "../types";

const generatedAt = "2026-06-11T00:00:00.000Z";

export const mockPlanningResult = {
  project: {
    id: "project-ai-planning-platform",
    title: "AI Planning Platform",
    description:
      "Turn user goals into structured component graphs and executable roadmaps.",
    status: "generated",
    createdAt: generatedAt,
    updatedAt: generatedAt,
  },
  requirement: {
    id: "requirement-initial-platform",
    projectId: "project-ai-planning-platform",
    content:
      "Build a platform that recommends components from user requirements, generates dependency graphs, and creates roadmaps.",
    source: "user",
    priority: "high",
    createdAt: generatedAt,
    updatedAt: generatedAt,
  },
  nodes: [
    {
      id: "node-requirement-input",
      type: "ui",
      label: "Requirement Input",
      description: "Collects the user's planning goal and initial constraints.",
      category: "Frontend",
      priority: "high",
      position: { x: 0, y: 80 },
      metadata: {
        owner: "apps/web",
      },
    },
    {
      id: "node-planning-api",
      type: "api",
      label: "Planning API",
      description:
        "Receives planning requests and coordinates mock or AI-generated results.",
      category: "Backend",
      priority: "high",
      position: { x: 280, y: 80 },
      metadata: {
        owner: "apps/api",
      },
    },
    {
      id: "node-ai-workflow",
      type: "ai",
      label: "AI Planning Workflow",
      description:
        "Analyzes requirements and produces recommended components, edges, and roadmap steps.",
      category: "AI Layer",
      priority: "high",
      position: { x: 560, y: 80 },
      metadata: {
        owner: "packages/ai",
      },
    },
    {
      id: "node-graph-canvas",
      type: "ui",
      label: "Graph Canvas",
      description: "Renders generated nodes and dependencies with React Flow.",
      category: "Frontend",
      priority: "high",
      position: { x: 280, y: 280 },
      metadata: {
        owner: "apps/web",
      },
    },
    {
      id: "node-roadmap-view",
      type: "feature",
      label: "Roadmap View",
      description: "Shows ordered implementation steps based on the graph.",
      category: "Planning",
      priority: "medium",
      position: { x: 560, y: 280 },
      metadata: {
        owner: "apps/web",
      },
    },
    {
      id: "node-project-storage",
      type: "data",
      label: "Project Storage",
      description:
        "Persists projects, requirements, generated graphs, and roadmaps.",
      category: "Persistence",
      priority: "medium",
      position: { x: 840, y: 180 },
      metadata: {
        owner: "infra/db",
      },
    },
  ],
  edges: [
    {
      id: "edge-input-to-api",
      source: "node-requirement-input",
      target: "node-planning-api",
      label: "submits requirement",
      dependencyType: "feeds",
    },
    {
      id: "edge-api-to-ai",
      source: "node-planning-api",
      target: "node-ai-workflow",
      label: "orchestrates generation",
      dependencyType: "requires",
    },
    {
      id: "edge-ai-to-canvas",
      source: "node-ai-workflow",
      target: "node-graph-canvas",
      label: "returns graph contract",
      dependencyType: "feeds",
    },
    {
      id: "edge-ai-to-roadmap",
      source: "node-ai-workflow",
      target: "node-roadmap-view",
      label: "returns roadmap",
      dependencyType: "feeds",
    },
    {
      id: "edge-api-to-storage",
      source: "node-planning-api",
      target: "node-project-storage",
      label: "persists planning result",
      dependencyType: "requires",
    },
  ],
  roadmap: [
    {
      id: "step-shared-contract",
      title: "Define shared planning contract",
      description:
        "Create the common TypeScript model for projects, requirements, graph nodes, edges, and roadmap steps.",
      order: 1,
      priority: "high",
      estimatedEffort: "small",
      dependsOn: [],
      componentNodeIds: ["node-ai-workflow", "node-graph-canvas"],
    },
    {
      id: "step-canvas-mvp",
      title: "Build Canvas MVP",
      description:
        "Render the mock planning result in a React Flow canvas with node details and roadmap panels.",
      order: 2,
      priority: "high",
      estimatedEffort: "medium",
      dependsOn: ["step-shared-contract"],
      componentNodeIds: [
        "node-requirement-input",
        "node-graph-canvas",
        "node-roadmap-view",
      ],
    },
    {
      id: "step-fastapi-skeleton",
      title: "Create FastAPI skeleton",
      description:
        "Expose health and mock planning endpoints that return the shared planning result shape.",
      order: 3,
      priority: "high",
      estimatedEffort: "medium",
      dependsOn: ["step-canvas-mvp"],
      componentNodeIds: ["node-planning-api"],
    },
    {
      id: "step-docker-runtime",
      title: "Add Docker runtime",
      description:
        "Introduce Docker Compose after the API skeleton and before database persistence.",
      order: 4,
      priority: "medium",
      estimatedEffort: "small",
      dependsOn: ["step-fastapi-skeleton"],
      componentNodeIds: ["node-planning-api", "node-project-storage"],
    },
  ],
  summary:
    "The MVP should first stabilize a shared graph contract, render it in the web canvas, then connect FastAPI, Docker, AI generation, and persistence in sequence.",
  metadata: {
    generatedAt,
    model: "mock",
    workflowVersion: "shared-contract-v1",
  },
} satisfies PlanningResult;
