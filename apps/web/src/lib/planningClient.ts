import type { PlanningRequest, PlanningResult } from "@ai-planning-platform/shared";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8000";

export async function generatePlanningResult(
  request: PlanningRequest,
): Promise<PlanningResult> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/planning/generate`, {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
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
