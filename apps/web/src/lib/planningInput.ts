import type { AIModelOption, PlanType, SuccessCriterion } from "@ai-planning-platform/shared";
import type { PlanningBriefDraft } from "../store/planningStore";

export const planTypeLabels: Record<PlanType, string> = {
  creative: "창작 / 아이디어",
  daily: "일상 / 루틴",
  decision: "선택 / 의사결정",
  event: "행사 / 여행",
  learning: "학습 / 성장",
  project: "프로젝트",
};

export const criterionLabels: Record<SuccessCriterion, string> = {
  balance: "균형",
  clarity: "명확함",
  consistency: "꾸준함",
  quality: "완성도",
  speed: "빠른 실행",
};

export function getReviewBlocker(input: { hasSelectedProject: boolean; requirementText: string }): string | null {
  if (!input.hasSelectedProject) return "프로젝트를 먼저 선택하거나 만들어 주세요.";
  if (!input.requirementText.trim()) return "계획 주제를 입력해 주세요.";
  if (input.requirementText.length > 8000) return "계획 주제는 8,000자 이내로 입력해 주세요.";
  return null;
}

export function getGenerationBlocker(input: {
  hasSelectedProject: boolean;
  modelStatus: "idle" | "loading" | "ready" | "error";
  models: AIModelOption[];
  selectedModel: string;
  requirementText: string;
  planningBrief: PlanningBriefDraft;
}): string | null {
  if (!input.hasSelectedProject) return "프로젝트를 먼저 선택하거나 만들어 주세요.";
  if (input.modelStatus === "loading" || input.modelStatus === "idle") return "AI 모델 목록을 불러오고 있습니다.";
  if (input.modelStatus === "error") return "AI 모델 목록을 다시 불러와 주세요.";
  if (input.models.length === 0) return "사용 가능한 AI 모델이 없습니다.";
  if (!input.models.some((model) => model.id === input.selectedModel)) return "AI 모델을 선택해 주세요.";
  if (!input.requirementText.trim()) return "계획 주제를 입력해 주세요.";
  if (!input.planningBrief.context.some((item) => item.trim())) return "상황 또는 대상을 1개 이상 입력해 주세요.";
  if (!input.planningBrief.actionItems.some((item) => item.text.trim())) return "해야 할 일을 1개 이상 입력해 주세요.";
  return null;
}
