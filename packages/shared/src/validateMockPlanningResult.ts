import { mockPlanningResult } from "./fixtures/mockPlanningResult.js";
import { validatePlanningResult } from "./validation.js";

const validation = validatePlanningResult(mockPlanningResult);

if (!validation.valid) {
  const issueSummary = validation.issues
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join("\n");

  throw new Error(`Mock planning result is invalid:\n${issueSummary}`);
}

console.log("Mock planning result satisfies the shared runtime contract.");
