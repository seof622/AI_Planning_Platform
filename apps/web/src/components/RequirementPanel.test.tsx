import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RequirementPanel } from "./RequirementPanel";

describe("RequirementPanel", () => {
  it("lets the user select one of the server-provided models", async () => {
    const user = userEvent.setup();
    const setSelectedModel = vi.fn();

    render(
      <RequirementPanel
        hasSelectedProject
        isLoading={false}
        modelErrorMessage={null}
        models={[
          {
            cost: "low",
            description: "빠르고 경제적인 초안 모델",
            id: "gpt-5-mini",
            label: "GPT-5 mini",
            quality: "standard",
            recommendedFor: "빠른 초안",
            speed: "fast",
          },
          {
            cost: "high",
            description: "깊이 있는 분석 모델",
            id: "gpt-5.6-sol",
            label: "GPT-5.6 Sol",
            quality: "highest",
            recommendedFor: "중요한 의사결정",
            speed: "deliberate",
          },
          {
            cost: "medium",
            description: "속도와 품질의 균형 모델",
            id: "gpt-5.6-luna",
            label: "GPT-5.6 Luna",
            quality: "high",
            recommendedFor: "일반 프로젝트",
            speed: "fast",
          },
        ]}
        modelStatus="ready"
        onGenerate={vi.fn()}
        onReset={vi.fn()}
        onShowError={vi.fn()}
        planningBrief={{
          actionItems: [{ necessity: "required", text: "Add tests" }],
          constraints: "",
          context: ["Web application"],
          planType: "project",
          successCriterion: "quality",
        }}
        requirementText="Build a test plan"
        selectedModel="gpt-5-mini"
        setPlanningBriefField={vi.fn()}
        setRequirementText={vi.fn()}
        setSelectedModel={setSelectedModel}
      />,
    );

    await user.selectOptions(screen.getByLabelText("AI 모델"), "gpt-5.6-luna");

    expect(setSelectedModel).toHaveBeenCalledWith("gpt-5.6-luna");
    expect(
      screen.getByRole("option", { name: "GPT-5.6 Luna" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "GPT-5.6 Sol · 추천" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("추천 모델")).toHaveTextContent(
      "완성도를 중요 기준으로 선택해 깊이 있는 분석을 우선합니다.",
    );
    expect(screen.getByText("빠르고 경제적인 초안 모델")).toBeInTheDocument();
    expect(screen.getByText("빠른 초안")).toBeInTheDocument();
  });
});
