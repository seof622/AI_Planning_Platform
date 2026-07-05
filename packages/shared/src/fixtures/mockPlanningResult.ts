import type { PlanningResult } from "../types.js";
import mockPlanningResultJson from "./mockPlanningResult.json" with { type: "json" };

export const mockPlanningResult = mockPlanningResultJson as PlanningResult;
