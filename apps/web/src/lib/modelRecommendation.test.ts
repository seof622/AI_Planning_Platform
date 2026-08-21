import type { AIModelOption } from "@ai-planning-platform/shared";
import { describe, expect, it } from "vitest";
import { recommendModel } from "./modelRecommendation";

const models: AIModelOption[] = [
  {
    cost: "low",
    description: "efficient",
    id: "gpt-5.6-luna",
    label: "Luna",
    quality: "high",
    recommendedFor: "volume",
    speed: "fast",
  },
  {
    cost: "medium",
    description: "balanced",
    id: "gpt-5.6-terra",
    label: "Terra",
    quality: "high",
    recommendedFor: "projects",
    speed: "balanced",
  },
  {
    cost: "high",
    description: "quality",
    id: "gpt-5.6-sol",
    label: "Sol",
    quality: "highest",
    recommendedFor: "decisions",
    speed: "deliberate",
  },
];

describe("recommendModel", () => {
  const simpleInput = {
    actionItems: [{ necessity: "required" as const, text: "할 일 하나" }],
    constraints: "",
    context: ["나 혼자"],
    planType: "daily" as const,
    requirementText: "오늘 계획",
    successCriterion: "speed" as const,
  };

  it("recommends an efficient model for a simple brief", () => {
    const recommendation = recommendModel(models, simpleInput);

    expect(recommendation?.model.id).toBe("gpt-5.6-luna");
    expect(recommendation?.complexity).toBe("simple");
  });

  it("recommends a balanced model for a moderately complex brief", () => {
    const recommendation = recommendModel(models, {
      ...simpleInput,
      actionItems: [
        { necessity: "required", text: "요구사항 정리" },
        { necessity: "required", text: "구현" },
      ],
      constraints: "예산과 일정을 준수해야 함",
      planType: "project",
      successCriterion: "balance",
    });

    expect(recommendation?.model.id).toBe("gpt-5.6-terra");
    expect(recommendation?.complexity).toBe("balanced");
  });

  it("recommends a quality model for a complex brief", () => {
    const recommendation = recommendModel(models, {
      actionItems: Array.from({ length: 5 }, (_, index) => ({
        necessity: "required" as const,
        text: `필수 작업 ${index + 1}`,
      })),
      constraints: "제한된 예산과 일정 안에서 여러 이해관계자의 승인을 받고 보안 및 개인정보 요구사항을 모두 충족해야 합니다. 출시 전에 부하 테스트와 장애 복구 훈련도 완료해야 합니다.",
      context: ["신규 서비스", "외부 고객", "운영 조직"],
      planType: "decision",
      requirementText: "여러 아키텍처 후보를 비교해 장기 운영 비용과 안정성을 고려한 최종 기술 의사결정 계획을 수립합니다.",
      successCriterion: "quality",
    });

    expect(recommendation?.model.id).toBe("gpt-5.6-sol");
    expect(recommendation?.complexity).toBe("complex");
    expect(recommendation?.score).toBeGreaterThanOrEqual(8);
  });

  it("uses only models supplied by the server", () => {
    expect(recommendModel([models[1]!], simpleInput)?.model.id).toBe(
      "gpt-5.6-terra",
    );
  });

  it("returns no recommendation for an empty catalog", () => {
    expect(recommendModel([], simpleInput)).toBeNull();
  });
});
