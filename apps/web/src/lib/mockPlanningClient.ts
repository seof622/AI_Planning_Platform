import { mockPlanningResult } from "@ai-planning-platform/shared";
import type { PlanningResult } from "@ai-planning-platform/shared";

export async function loadMockPlanningResult(): Promise<PlanningResult> {
  await new Promise((resolve) => window.setTimeout(resolve, 250));

  return mockPlanningResult;
}
