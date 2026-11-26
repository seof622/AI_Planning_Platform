import type { PlanningBrief, PlanningResult } from "./types.js";

export type ReviewPreference = "balanced" | "cost" | "quality" | "speed";
export interface ReviewInput {
  requirement: string;
  brief: PlanningBrief;
  preference: ReviewPreference;
}
export interface ReviewScore {
  value: number | null;
  reason: string;
  missingInformation: string | null;
}
export type ReviewAxis = "clarity" | "expertise" | "reasoning" | "scope";
export interface InputFeedback {
  goal: string;
  clearPoints: string[];
  questions: Array<{
    field: "requirement" | "context" | "actionItems" | "constraints" | "completion";
    question: string;
    reason: string;
  }>;
  assumptions: string[];
  warnings: string[];
  assessment: Record<ReviewAxis, ReviewScore>;
}
export interface ReviewRecommendation {
  model: string;
  profile: "efficient" | "balanced" | "quality";
  reason: string;
  uncertainty: string | null;
  policyVersion: string;
  allowedModels: string[];
  features: { contextCount: number; actionCount: number; constraintCharacters: number };
}
export interface PlanningReview {
  id: string;
  projectId: string;
  parentReviewId: string | null;
  input: ReviewInput;
  inputHash: string;
  feedback: InputFeedback | null;
  recommendation: ReviewRecommendation | null;
  promptVersion: string;
  rubricVersion: string;
  createdAt: string;
}
export interface PlanningDecision {
  id: string;
  projectId: string;
  reviewId: string;
  kind: "selection" | "confirmation";
  selectedModel: string;
  acceptedRecommendation: boolean;
  snapshot: { input: ReviewInput; assumptions: string[]; selectedModel: string };
  createdAt: string;
}
export interface AIExecutionRun {
  id: string;
  projectId: string;
  reviewId: string | null;
  confirmationId: string | null;
  kind: "review" | "generation";
  status: "running" | "succeeded" | "failed" | "interrupted";
  idempotencyKey: string;
  requestedModel: string;
  resolvedModel: string | null;
  usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number; [key: string]: unknown } | null;
  estimatedCost: number | null;
  rateVersion: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  resultId: string | null;
  createdAt: string;
  finishedAt: string | null;
  elapsedMs: number | null;
}
export interface ReviewExecutionResponse {
  run: AIExecutionRun;
  review: PlanningReview | null;
  result: PlanningResult | null;
}
export interface PlanningReviewDetail {
  review: PlanningReview;
  decisions: PlanningDecision[];
  runs: AIExecutionRun[];
}
export interface PlanningQualityEvaluation {
  id: string;
  resultId: string;
  source: "user";
  criteriaVersion: string;
  rating: number;
  comment: string;
  createdAt: string;
}

/** Validate AI output at the runtime boundary, not just TypeScript compilation. */
export function validateInputFeedback(value: unknown): value is InputFeedback {
  if (!value || typeof value !== "object") return false;
  const feedback = value as Partial<InputFeedback>;
  const textList = (items: unknown, limit: number) => Array.isArray(items) && items.length <= limit
    && items.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 1000);
  if (typeof feedback.goal !== "string" || !feedback.goal.trim() || feedback.goal.length > 1000
    || !textList(feedback.clearPoints, 8) || !textList(feedback.assumptions, 6)
    || !textList(feedback.warnings, 5) || !Array.isArray(feedback.questions) || feedback.questions.length > 3) return false;
  const fields = ["requirement", "context", "actionItems", "constraints", "completion"];
  if (!feedback.questions.every((q) => q && fields.includes(q.field) && typeof q.question === "string"
    && q.question.trim().length > 0 && q.question.length <= 400 && typeof q.reason === "string"
    && q.reason.trim().length > 0 && q.reason.length <= 400)) return false;
  return (["clarity", "expertise", "reasoning", "scope"] as const).every((axis) => {
    const score = feedback.assessment?.[axis];
    return score && (score.value === null || (Number.isInteger(score.value) && score.value >= 0 && score.value <= 4))
      && typeof score.reason === "string" && score.reason.trim().length > 0 && score.reason.length <= 600
      && (score.missingInformation === null || (typeof score.missingInformation === "string" && score.missingInformation.length <= 600))
      && (score.value !== null || (typeof score.missingInformation === "string" && score.missingInformation.trim().length > 0));
  });
}

export function normalizeReviewInput(input: ReviewInput): ReviewInput {
  const clean = (text: string) => text.replace(/\r\n?/g, "\n").normalize("NFC").trim();
  return {
    requirement: clean(input.requirement),
    brief: {
      actionItems: input.brief.actionItems.filter((item) => item.title.trim()).map((item) => ({
        title: clean(item.title),
        necessity: item.necessity,
      })),
      context: input.brief.context.filter((item) => item.trim()).map(clean),
      ...(clean(input.brief.constraints ?? "") ? { constraints: clean(input.brief.constraints ?? "") } : {}),
      planType: input.brief.planType,
      successCriterion: input.brief.successCriterion,
    },
    preference: input.preference,
  };
}

export function sameReviewInput(left: ReviewInput, right: ReviewInput): boolean {
  return JSON.stringify(normalizeReviewInput(left)) === JSON.stringify(normalizeReviewInput(right));
}
