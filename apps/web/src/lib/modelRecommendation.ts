import type {
  AIModelOption,
  PlanType,
  SuccessCriterion,
} from "@ai-planning-platform/shared";

export interface ModelRecommendation {
  model: AIModelOption;
  reason: string;
}

const modelPriorities = {
  efficient: ["gpt-5.6-luna", "gpt-5-mini", "gpt-5.6-terra", "gpt-5.6-sol"],
  quality: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5-mini"],
  balanced: ["gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5-mini"],
} as const;

export function recommendModel(
  models: AIModelOption[],
  planType: PlanType,
  successCriterion: SuccessCriterion,
): ModelRecommendation | null {
  if (models.length === 0) {
    return null;
  }

  let profile: keyof typeof modelPriorities = "balanced";
  let reason = "계획의 복잡도와 응답 효율을 균형 있게 고려했습니다.";

  if (successCriterion === "quality" || planType === "decision") {
    profile = "quality";
    reason =
      successCriterion === "quality"
        ? "완성도를 중요 기준으로 선택해 깊이 있는 분석을 우선합니다."
        : "의사결정 계획에 필요한 비교와 분석 품질을 우선합니다.";
  } else if (
    successCriterion === "speed" ||
    planType === "daily" ||
    planType === "event"
  ) {
    profile = "efficient";
    reason =
      successCriterion === "speed"
        ? "빠른 실행을 중요 기준으로 선택해 응답 속도를 우선합니다."
        : "반복해서 조정하기 쉬운 빠르고 효율적인 생성을 우선합니다.";
  }

  const modelById = new Map(models.map((model) => [model.id, model]));
  const model = modelPriorities[profile]
    .map((modelId) => modelById.get(modelId))
    .find((candidate): candidate is AIModelOption => candidate !== undefined);

  return { model: model ?? models[0]!, reason };
}
