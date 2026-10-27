import { cleanup, render, screen } from "@testing-library/react";
import { mockPlanningResult } from "@ai-planning-platform/shared";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoadmapStepDetailPanel } from "./RoadmapStepDetailPanel";

const props = { step: mockPlanningResult.roadmap[0]!, roadmap: mockPlanningResult.roadmap, nodes: mockPlanningResult.nodes,
  disabled: false, saveBlocked: false, editStatus: "dirty", errorMessage: null,
  onClose: vi.fn(), onChange: vi.fn(), onMove: vi.fn(), onDelete: vi.fn(), onSave: vi.fn(),
} satisfies React.ComponentProps<typeof RoadmapStepDetailPanel>;

describe("RoadmapStepDetailPanel", () => {
  afterEach(cleanup);
  it("edits only the selected step and preserves the whole-result save action", async () => {
    const change = vi.fn();
    const save = vi.fn();
    const { rerender } = render(<RoadmapStepDetailPanel {...props} onChange={change} onSave={save} />);
    await userEvent.clear(screen.getByLabelText("1단계 제목"));
    expect(change).toHaveBeenCalledWith(props.step.id, { title: "" });
    await userEvent.selectOptions(screen.getByLabelText("1단계 우선순위"), "low");
    expect(change).toHaveBeenCalledWith(props.step.id, { priority: "low" });
    await userEvent.click(screen.getByRole("button", { name: "변경 내용을 새 버전으로 저장" }));
    expect(save).toHaveBeenCalledOnce();
    rerender(<RoadmapStepDetailPanel {...props} step={mockPlanningResult.roadmap[1]!} />);
    expect(screen.queryByLabelText("1단계 제목")).not.toBeInTheDocument();
    expect(screen.getByLabelText("2단계 제목")).toHaveValue(mockPlanningResult.roadmap[1]!.title);
  });
  it("edits references and exposes ordering and deletion for the selected ID", async () => {
    const change = vi.fn();
    const move = vi.fn();
    const remove = vi.fn();
    render(<RoadmapStepDetailPanel {...props} onChange={change} onMove={move} onDelete={remove} />);
    await userEvent.click(screen.getByText(/선행 단계 ·/));
    await userEvent.click(screen.getByLabelText(`1단계 선행 단계: ${mockPlanningResult.roadmap[1]!.title}`));
    expect(change).toHaveBeenCalledWith(props.step.id, { dependsOn: [mockPlanningResult.roadmap[1]!.id] });
    await userEvent.click(screen.getByRole("button", { name: `${props.step.title} 뒤로 이동` }));
    expect(move).toHaveBeenCalledWith(props.step.id, 1);
    await userEvent.click(screen.getByRole("button", { name: `${props.step.title} 단계 삭제` }));
    expect(remove).toHaveBeenCalledWith(props.step.id);
  });
  it("navigates to linked nodes without changing references and locks navigation while loading", async () => {
    const navigate = vi.fn();
    const change = vi.fn();
    const { rerender } = render(<RoadmapStepDetailPanel {...props} onNavigateNode={navigate} onChange={change} />);
    await userEvent.click(screen.getByRole("button", { name: "관련 노드 그래프 캔버스 위치로 이동" }));
    expect(navigate).toHaveBeenCalledWith("node-graph-canvas");
    expect(change).not.toHaveBeenCalled();
    rerender(<RoadmapStepDetailPanel {...props} onNavigateNode={navigate} disabled />);
    expect(screen.getByRole("button", { name: "관련 노드 그래프 캔버스 위치로 이동" })).toBeDisabled();
  });
  it("prevents editing and saving during loading or a version conflict", () => {
    const { rerender } = render(<RoadmapStepDetailPanel {...props} disabled />);
    expect(screen.getByLabelText("1단계 제목")).toBeDisabled();
    expect(screen.getByRole("button", { name: "변경 내용을 새 버전으로 저장" })).toBeDisabled();
    expect(screen.getByRole("button", { name: `${props.step.title} 단계 삭제` })).toBeDisabled();
    rerender(<RoadmapStepDetailPanel {...props} saveBlocked />);
    expect(screen.getByLabelText("1단계 제목")).toBeEnabled();
    expect(screen.getByRole("button", { name: "변경 내용을 새 버전으로 저장" })).toBeDisabled();
  });
});
