export type PlanningOperationTarget =
  | { kind: "projects" }
  | { kind: "project"; projectId: string }
  | { kind: "version"; projectId: string; resultId: string }
  | { kind: "generate"; projectId: string }
  | { kind: "restore"; projectId: string; resultId: string };

export type PlanningOperation = PlanningOperationTarget & { startedAt: number };

export const operationLabels: Record<PlanningOperation["kind"], string> = {
  projects: "프로젝트 목록 불러오는 중",
  project: "프로젝트 불러오는 중",
  version: "버전 불러오는 중",
  generate: "AI 생성 중",
  restore: "버전 복원 중",
};

export const operationFailureLabels: Record<PlanningOperation["kind"], string> = {
  projects: "프로젝트 목록 조회 실패",
  project: "프로젝트 조회 실패",
  version: "버전 조회 실패",
  generate: "AI 생성 실패",
  restore: "버전 복원 실패",
};
