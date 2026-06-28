import type { PlanningResult } from "../types.js";

const generatedAt = "2026-06-11T00:00:00.000Z";

export const mockPlanningResult = {
  project: {
    id: "project-ai-planning-platform",
    title: "플랜노트",
    description:
      "사용자 목표를 구조화된 컴포넌트 그래프와 실행 가능한 로드맵으로 전환합니다.",
    status: "generated",
    createdAt: generatedAt,
    updatedAt: generatedAt,
  },
  requirement: {
    id: "requirement-initial-platform",
    projectId: "project-ai-planning-platform",
    content:
      "사용자 요구사항에서 컴포넌트를 추천하고, 의존성 그래프와 로드맵을 생성하는 플랫폼을 구축합니다.",
    source: "user",
    priority: "high",
    createdAt: generatedAt,
    updatedAt: generatedAt,
  },
  nodes: [
    {
      id: "node-requirement-input",
      type: "ui",
      label: "요구사항 입력",
      description: "사용자의 계획 목표와 초기 제약사항을 수집합니다.",
      category: "프론트엔드",
      priority: "high",
      position: { x: 0, y: 80 },
      metadata: {
        owner: "apps/web",
      },
    },
    {
      id: "node-planning-api",
      type: "api",
      label: "계획 API",
      description:
        "계획 요청을 받고 목업 또는 AI 생성 결과를 조율합니다.",
      category: "백엔드",
      priority: "high",
      position: { x: 390, y: 80 },
      metadata: {
        owner: "apps/api",
      },
    },
    {
      id: "node-ai-workflow",
      type: "ai",
      label: "AI 계획 워크플로",
      description:
        "요구사항을 분석해 추천 컴포넌트, 엣지, 로드맵 단계를 생성합니다.",
      category: "AI 계층",
      priority: "high",
      position: { x: 780, y: 80 },
      metadata: {
        owner: "packages/ai",
      },
    },
    {
      id: "node-graph-canvas",
      type: "ui",
      label: "그래프 캔버스",
      description: "생성된 노드와 의존성을 React Flow로 렌더링합니다.",
      category: "프론트엔드",
      priority: "high",
      position: { x: 390, y: 330 },
      metadata: {
        owner: "apps/web",
      },
    },
    {
      id: "node-roadmap-view",
      type: "feature",
      label: "로드맵 보기",
      description: "그래프를 기반으로 정렬된 구현 단계를 보여줍니다.",
      category: "계획",
      priority: "medium",
      position: { x: 780, y: 330 },
      metadata: {
        owner: "apps/web",
      },
    },
    {
      id: "node-project-storage",
      type: "data",
      label: "프로젝트 저장소",
      description:
        "프로젝트, 요구사항, 생성된 그래프와 로드맵을 저장합니다.",
      category: "영속성",
      priority: "medium",
      position: { x: 1170, y: 205 },
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
      label: "요구사항 제출",
      dependencyType: "feeds",
    },
    {
      id: "edge-api-to-ai",
      source: "node-planning-api",
      target: "node-ai-workflow",
      label: "생성 조율",
      dependencyType: "requires",
    },
    {
      id: "edge-ai-to-canvas",
      source: "node-ai-workflow",
      target: "node-graph-canvas",
      label: "그래프 계약 반환",
      dependencyType: "feeds",
    },
    {
      id: "edge-ai-to-roadmap",
      source: "node-ai-workflow",
      target: "node-roadmap-view",
      label: "로드맵 반환",
      dependencyType: "feeds",
    },
    {
      id: "edge-api-to-storage",
      source: "node-planning-api",
      target: "node-project-storage",
      label: "계획 결과 저장",
      dependencyType: "requires",
    },
  ],
  roadmap: [
    {
      id: "step-shared-contract",
      title: "공유 계획 계약 정의",
      description:
        "프로젝트, 요구사항, 그래프 노드, 엣지, 로드맵 단계를 위한 공통 TypeScript 모델을 만듭니다.",
      order: 1,
      priority: "high",
      estimatedEffort: "small",
      dependsOn: [],
      componentNodeIds: ["node-ai-workflow", "node-graph-canvas"],
    },
    {
      id: "step-canvas-mvp",
      title: "캔버스 MVP 구축",
      description:
        "노드 상세와 로드맵 패널을 포함한 React Flow 캔버스에 목업 계획 결과를 렌더링합니다.",
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
      title: "FastAPI 골격 생성",
      description:
        "공유 계획 결과 형태를 반환하는 상태 확인 및 목업 계획 엔드포인트를 노출합니다.",
      order: 3,
      priority: "high",
      estimatedEffort: "medium",
      dependsOn: ["step-canvas-mvp"],
      componentNodeIds: ["node-planning-api"],
    },
    {
      id: "step-docker-runtime",
      title: "Docker 런타임 추가",
      description:
        "API 골격 이후, 데이터베이스 영속성 이전 단계로 Docker Compose를 도입합니다.",
      order: 4,
      priority: "medium",
      estimatedEffort: "small",
      dependsOn: ["step-fastapi-skeleton"],
      componentNodeIds: ["node-planning-api", "node-project-storage"],
    },
  ],
  summary:
    "MVP는 먼저 공유 그래프 계약을 안정화하고 웹 캔버스에 렌더링한 뒤 FastAPI, Docker, AI 생성, 영속성을 순서대로 연결해야 합니다.",
  metadata: {
    generatedAt,
    model: "mock",
    workflowVersion: "shared-contract-v1",
  },
} satisfies PlanningResult;
