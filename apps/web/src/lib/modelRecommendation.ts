import type {
  AIModelOption,
  PlanType,
  SuccessCriterion,
} from "@ai-planning-platform/shared";

export interface ModelRecommendation {
  complexity: "simple" | "balanced" | "complex";
  model: AIModelOption;
  reason: string;
  score: number;
}

export interface ModelRecommendationInput {
  actionItems: Array<{ necessity: "required" | "optional"; text: string }>;
  constraints: string;
  context: string[];
  planType: PlanType;
  requirementText: string;
  successCriterion: SuccessCriterion;
}

const modelPriorities = {
  efficient: ["gpt-5.6-luna", "gpt-5-mini", "gpt-5.6-terra", "gpt-5.6-sol"],
  quality: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5-mini"],
  balanced: ["gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5-mini"],
} as const;

export function recommendModel(
  models: AIModelOption[],
  input: ModelRecommendationInput,
): ModelRecommendation | null {
  if (models.length === 0) {
    return null;
  }

  const { score, signals } = calculateComplexityScore(input);
  const complexity =
    score >= 8 ? "complex" : score >= 4 ? "balanced" : "simple";
  const profile: keyof typeof modelPriorities =
    complexity === "complex"
      ? "quality"
      : complexity === "simple"
        ? "efficient"
        : "balanced";

  const modelById = new Map(models.map((model) => [model.id, model]));
  const model = modelPriorities[profile]
    .map((modelId) => modelById.get(modelId))
    .find((candidate): candidate is AIModelOption => candidate !== undefined);

  return {
    complexity,
    model: model ?? models[0]!,
    reason:
      signals.length > 0
        ? `${signals.slice(0, 3).join(", ")}을 반영했습니다.`
        : "간단한 계획 입력과 일반적인 생성 비용을 고려했습니다.",
    score,
  };
}

function calculateComplexityScore(input: ModelRecommendationInput): {
  score: number;
  signals: string[];
} {
  let score = 0;
  const signals: string[] = [];
  const requirementLength = input.requirementText.trim().length;
  const contextCount = input.context.filter((item) => item.trim()).length;
  const actions = input.actionItems.filter((item) => item.text.trim());
  const requiredActionCount = actions.filter(
    (item) => item.necessity === "required",
  ).length;
  const constraintsLength = input.constraints.trim().length;

  if (requirementLength >= 120) {
    score += 2;
    signals.push("상세한 계획 주제");
  } else if (requirementLength >= 40) {
    score += 1;
    signals.push("구체적인 계획 주제");
  }

  if (contextCount >= 3) {
    score += 2;
    signals.push("여러 상황과 대상");
  } else if (contextCount >= 2) {
    score += 1;
    signals.push("복수의 상황과 대상");
  }

  if (actions.length >= 5) {
    score += 3;
    signals.push("다수의 실행 항목");
  } else if (actions.length >= 3) {
    score += 2;
    signals.push("여러 실행 항목");
  } else if (actions.length >= 2) {
    score += 1;
    signals.push("복수의 실행 항목");
  }
  if (requiredActionCount >= 3) {
    score += 1;
    signals.push("다수의 필수 작업");
  }

  if (constraintsLength >= 100) {
    score += 3;
    signals.push("복잡한 제약조건");
  } else if (constraintsLength >= 30) {
    score += 2;
    signals.push("구체적인 제약조건");
  } else if (constraintsLength > 0) {
    score += 1;
    signals.push("제약조건");
  }

  if (input.planType === "project" || input.planType === "decision") {
    score += 2;
    signals.push(
      input.planType === "decision" ? "의사결정 계획" : "프로젝트 계획",
    );
  } else if (
    input.planType === "learning" ||
    input.planType === "creative"
  ) {
    score += 1;
  }

  if (input.successCriterion === "quality") {
    score += 2;
    signals.push("완성도 우선 기준");
  } else if (
    input.successCriterion === "clarity" ||
    input.successCriterion === "consistency"
  ) {
    score += 1;
  } else if (input.successCriterion === "speed") {
    score -= 2;
    signals.push("빠른 실행 기준");
  }

  return { score: Math.max(0, score), signals };
}
