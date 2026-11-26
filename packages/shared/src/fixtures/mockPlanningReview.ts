import type { AIExecutionRun, InputFeedback, PlanningReview, ReviewInput } from "../planningReview.js";

/** Deterministic fixture for contract, UI and recovery tests; never a live AI assessment. */
export const mockReviewInput: ReviewInput = {
  requirement: "직원 교육 준비", preference: "balanced",
  brief: { context: [], actionItems: [], planType: "project", successCriterion: "clarity" },
};
export const mockInputFeedback: InputFeedback = {
  goal: "직원 교육에 필요한 자료와 진행 일정을 준비합니다.", clearPoints: ["직원 교육 준비"],
  questions: [{ field: "context", question: "교육 대상과 예정일이 정해져 있나요?", reason: "대상과 일정에 맞는 작업을 정하기 위해 필요합니다." }],
  assumptions: ["확정 날짜 대신 준비 시작일을 기준으로 일정을 제안합니다."], warnings: [],
  assessment: {
    clarity: { value: 1, reason: "교육 대상과 완료 조건을 확인해야 합니다.", missingInformation: "대상과 예정일" },
    expertise: { value: null, reason: "교육 분야가 정해지지 않았습니다.", missingInformation: "교육 주제" },
    reasoning: { value: 2, reason: "자료와 진행 일정 사이의 선후 관계가 있습니다.", missingInformation: null },
    scope: { value: 1, reason: "한 번의 교육을 준비하는 범위입니다.", missingInformation: null },
  },
};
export const mockPlanningReview: PlanningReview = {
  id: "review-fixture", projectId: "project-review-fixture", parentReviewId: null,
  input: mockReviewInput, inputHash: "a".repeat(64), feedback: mockInputFeedback,
  recommendation: { model: "gpt-5-mini", profile: "balanced", reason: "여러 작업의 선후 관계를 고려했습니다.",
    uncertainty: "교육 분야를 보완하면 추천이 달라질 수 있습니다.", policyVersion: "planning-model-policy-v1",
    allowedModels: ["gpt-5-mini", "gpt-5.6-sol"], features: { contextCount: 0, actionCount: 0, constraintCharacters: 0 } },
  promptVersion: "planning-review-prompt-v1", rubricVersion: "planning-review-rubric-v1", createdAt: "2026-11-24T00:00:00Z",
};
export const mockReviewRun: AIExecutionRun = {
  id: "run-review-fixture", projectId: mockPlanningReview.projectId, reviewId: mockPlanningReview.id,
  confirmationId: null, kind: "review", status: "succeeded", idempotencyKey: "review-fixture-key",
  requestedModel: "gpt-5-mini", resolvedModel: null, usage: null, estimatedCost: null, rateVersion: null,
  errorCode: null, errorMessage: null, resultId: null, createdAt: "2026-11-24T00:00:00Z",
  finishedAt: "2026-11-24T00:00:01Z", elapsedMs: 1000,
};
