import { mockPlanningResult } from "@ai-planning-platform/shared";
import type { PlanningRequest, PlanningResult } from "@ai-planning-platform/shared";

export async function loadMockPlanningResult(
  request: PlanningRequest,
): Promise<PlanningResult> {
  await new Promise((resolve) => window.setTimeout(resolve, 250));

  const requirement = request.requirement.trim();

  return {
    ...mockPlanningResult,
    requirement: {
      ...mockPlanningResult.requirement,
      content: requirement || mockPlanningResult.requirement.content,
    },
  };
}
