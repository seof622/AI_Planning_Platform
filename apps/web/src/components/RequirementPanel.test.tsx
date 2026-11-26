import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequirementPanel } from "./RequirementPanel";
import { usePlanningStore } from "../store/planningStore";

const baseProps = {
  hasSelectedProject: true, isLoading: false, modelErrorMessage: null,
  models: [{ id: "mock", label: "Test model", description: "Test", recommendedFor: "Test",
    cost: "low", speed: "fast", quality: "standard" }],
  modelStatus: "ready", selectedModel: "mock", requirementText: "",
  planningBrief: usePlanningStore.getInitialState().planningBrief,
  onReview: vi.fn(), onReset: vi.fn(), onShowError: vi.fn(),
  setPlanningBriefField: vi.fn(), setRequirementText: vi.fn(), setSelectedModel: vi.fn(),
} satisfies React.ComponentProps<typeof RequirementPanel>;

describe("RequirementPanel", () => {
  afterEach(cleanup);
  it("keeps the submitted input read-only while generation is running", () => {
    render(<RequirementPanel {...baseProps} isLoading loadingLabel="생성 중" />);
    expect(screen.getByRole("button", { name: "생성 중" })).toBeDisabled();
    expect(screen.getByLabelText("계획 요구사항")).toBeDisabled();
    expect(screen.getByLabelText("상황 또는 대상 1")).toBeDisabled();
    expect(screen.getByLabelText("해야 할 일 1")).toBeDisabled();
    expect(screen.getByLabelText("AI 모델")).toBeDisabled();
  });

  it("offers a model catalog retry without reloading the page", async () => {
    const retry = vi.fn();
    render(<RequirementPanel {...baseProps} models={[]} modelStatus="error" modelErrorMessage="모델 조회 실패" onRetryModels={retry} />);
    await userEvent.click(screen.getByRole("button", { name: "모델 다시 불러오기" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "AI 입력 검토" })).toBeDisabled();
  });
  it("keeps the submitted input read-only while generation is running", () => {
    render(<RequirementPanel {...baseProps} isLoading loadingLabel="생성 중" />);
    expect(screen.getByRole("button", { name: "생성 중" })).toBeDisabled();
    expect(screen.getByLabelText("계획 요구사항")).toBeDisabled();
    expect(screen.getByLabelText("상황 또는 대상 1")).toBeDisabled();
    expect(screen.getByLabelText("해야 할 일 1")).toBeDisabled();
    expect(screen.getByLabelText("AI 모델")).toBeDisabled();
  });

  it("offers a model catalog retry without reloading the page", async () => {
    const retry = vi.fn();
    render(<RequirementPanel {...baseProps} models={[]} modelStatus="error" modelErrorMessage="모델 조회 실패" onRetryModels={retry} />);
    await userEvent.click(screen.getByRole("button", { name: "모델 다시 불러오기" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "AI 입력 검토" })).toBeDisabled();
  });
  it("allows input review with only a topic and keeps generation behind confirmation", () => {
    const { rerender } = render(<RequirementPanel {...baseProps} />);
    const button = screen.getByRole("button", { name: "AI 입력 검토" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("계획 주제를 입력해 주세요.");
    rerender(<RequirementPanel {...baseProps} requirementText="A plan" />);
    expect(button).toBeEnabled();
    const brief = { ...baseProps.planningBrief, context: ["My project"] };
    rerender(<RequirementPanel {...baseProps} requirementText="A plan" planningBrief={brief} />);
    expect(button).toBeEnabled();
    rerender(<RequirementPanel {...baseProps} requirementText="A plan"
      planningBrief={{ ...brief, actionItems: [{ necessity: "optional", text: "First action" }] }} />);
    expect(button).toBeEnabled();
  });

  it("keeps autosave retry separate from applying inputs to an existing result", async () => {
    const retry = vi.fn();
    render(<RequirementPanel {...baseProps} hasResult hasUnappliedInput briefSaveStatus="error"
      briefSaveErrorMessage="저장 연결 실패" onRetryBriefSave={retry} />);
    expect(screen.getByLabelText("입력 초안 저장 상태")).toHaveTextContent("입력 초안 자동 저장 실패");
    expect(screen.getByRole("alert")).toHaveTextContent("저장 연결 실패");
    expect(screen.getByText("입력 변경됨")).toBeVisible();
    expect(screen.getByRole("button", { name: "AI 입력 검토" })).toHaveAccessibleDescription(/현재 입력은 아직 결과에 반영되지 않았습니다/);
    expect(screen.getByRole("button", { name: "AI 입력 검토" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "입력 초안 저장 재시도" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("does not advertise autosaving while viewing a historical version", () => {
    render(<RequirementPanel {...baseProps} isViewingHistoricalResult briefSaveStatus="saved" />);
    expect(screen.getByLabelText("입력 초안 저장 상태")).toHaveTextContent("자동 저장 일시 중지");
  });

  it("lets the user select one of the server-provided models", async () => {
    const user = userEvent.setup();
    const setSelectedModel = vi.fn();

    render(
      <RequirementPanel
        recommendation={{ model: "gpt-5.6-luna", profile: "balanced", reason: "여러 작업의 의존 관계를 반영했습니다.",
          uncertainty: null, policyVersion: "test", allowedModels: ["gpt-5-mini", "gpt-5.6-luna", "gpt-5.6-sol"],
          features: { contextCount: 1, actionCount: 1, constraintCharacters: 0 } }}
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
        onReview={vi.fn()}
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
      screen.getByRole("option", { name: "GPT-5.6 Luna · 추천" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "GPT-5.6 Sol" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("추천 모델")).toHaveTextContent(
      "여러 작업의 의존 관계를 반영했습니다.",
    );
    expect(screen.getByText("빠르고 경제적인 초안 모델")).toBeInTheDocument();
    expect(screen.getByText("빠른 초안")).toBeInTheDocument();
  });
});
