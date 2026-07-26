import type {
  AIModelCatalog,
  PlanningRequest,
  PlanningResult,
  Project,
} from "@ai-planning-platform/shared";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8000";

export async function generatePlanningResult(
  projectId: string,
  request: PlanningRequest,
): Promise<PlanningResult> {
  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/planning/generate`,
      {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      },
    );
  } catch {
    throw new Error("API 서버에 연결할 수 없습니다. FastAPI 서버가 실행 중인지 확인해 주세요.");
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(
      errorBody?.detail ?? "API에서 AI 계획 결과를 생성하지 못했습니다.",
    );
  }

  return (await response.json()) as PlanningResult;
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new Error("API 서버에 연결할 수 없습니다. FastAPI 서버가 실행 중인지 확인해 주세요.");
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(errorBody?.detail ?? "API 요청을 처리하지 못했습니다.");
  }

  return (await response.json()) as T;
}

export function listProjects(): Promise<Project[]> {
  return requestJson<Project[]>("/projects");
}

export function getPlanningModels(): Promise<AIModelCatalog> {
  return requestJson<AIModelCatalog>("/planning/models");
}

export function createProject(
  title: string,
  description = "",
): Promise<Project> {
  return requestJson<Project>("/projects", {
    body: JSON.stringify({ description, title }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

export async function getLatestPlanningResult(
  projectId: string,
): Promise<PlanningResult | null> {
  const path = `/projects/${encodeURIComponent(projectId)}/planning-results/latest`;
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`);
  } catch {
    throw new Error("API 서버에 연결할 수 없습니다. FastAPI 서버가 실행 중인지 확인해 주세요.");
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(errorBody?.detail ?? "저장된 계획을 불러오지 못했습니다.");
  }

  return (await response.json()) as PlanningResult;
}
