import { cleanup, render, screen } from "@testing-library/react";
import { mockPlanningResult } from "@ai-planning-platform/shared";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoadmapPanel } from "./RoadmapPanel";

const baseProps = { editErrorMessage: null, editStatus: "idle", errorMessage: null,
  selectedStepId: null, onSelect: vi.fn(), onAdd: vi.fn(), onSave: vi.fn(), roadmap: mockPlanningResult.roadmap,
  status: "ready" } satisfies React.ComponentProps<typeof RoadmapPanel>;

describe("RoadmapPanel", () => {
  afterEach(cleanup);
  it("lets ten steps be read and selected without edit forms", async () => {
    const select = vi.fn();
    const steps = Array.from({ length: 10 }, (_, index) => ({ ...mockPlanningResult.roadmap[0]!,
      id: `step-${index}`, order: index + 1, title: `실행 ${index + 1}`, description: `작업 설명 ${index + 1}`,
      dependsOn: index ? [`step-${index - 1}`] : [] }));
    render(<RoadmapPanel {...baseProps} roadmap={steps} onSelect={select} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("작업 설명 10")).toBeInTheDocument();
    expect(screen.getByText("선행 9")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "10단계 실행 10 편집" }));
    expect(select).toHaveBeenCalledWith("step-9");
  });
  it("reflects selection, can close it and preserves the common save action", async () => {
    const select = vi.fn();
    const save = vi.fn();
    const step = mockPlanningResult.roadmap[0]!;
    render(<RoadmapPanel {...baseProps} selectedStepId={step.id} editStatus="dirty" onSelect={select} onSave={save} />);
    const button = screen.getByRole("button", { name: `${step.order}단계 ${step.title} 편집` });
    expect(button).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(button);
    expect(select).toHaveBeenCalledWith(null);
    await userEvent.click(screen.getByRole("button", { name: "변경 내용을 새 버전으로 저장" }));
    expect(save).toHaveBeenCalledOnce();
  });
  it("can save an empty roadmap and add the first step", async () => {
    const add = vi.fn();
    render(<RoadmapPanel {...baseProps} roadmap={[]} editStatus="dirty" onAdd={add} />);
    expect(screen.getByText(/단계가 없습니다/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "단계 추가" }));
    expect(add).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "변경 내용을 새 버전으로 저장" })).toBeEnabled();
  });
});