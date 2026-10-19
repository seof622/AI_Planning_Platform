import { cleanup, render, screen, within } from "@testing-library/react";
import { mockPlanningResult } from "@ai-planning-platform/shared";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoadmapPanel } from "./RoadmapPanel";

const roadmap = [
  {
    componentNodeIds: ["node-api"],
    dependsOn: [],
    description: "요구사항을 정리합니다.",
    estimatedEffort: "small" as const,
    id: "step-one",
    order: 1,
    priority: "high" as const,
    title: "요구사항 정리",
  },
  {
    componentNodeIds: ["node-api"],
    dependsOn: ["step-one"],
    description: "API를 구현합니다.",
    estimatedEffort: "large" as const,
    id: "step-two",
    order: 2,
    priority: "medium" as const,
    title: "API 구현",
  },
];

describe("RoadmapPanel", () => {
  afterEach(cleanup);
  it("edits, reorders, and saves roadmap steps", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onMove = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <RoadmapPanel
        editErrorMessage={null}
        editStatus="dirty"
        errorMessage={null}
        nodes={mockPlanningResult.nodes}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onChange={onChange}
        onMove={onMove}
        onSave={onSave}
        roadmap={roadmap}
        status="ready"
      />,
    );

    await user.clear(screen.getByLabelText("1단계 제목"));
    await user.type(screen.getByLabelText("1단계 제목"), "범위 정의");
    await user.selectOptions(screen.getByLabelText("1단계 우선순위"), "low");
    await user.selectOptions(screen.getByLabelText("1단계 예상 작업량"), "medium");
    await user.click(screen.getByRole("button", { name: "요구사항 정리 뒤로 이동" }));
    await user.click(screen.getByRole("button", { name: "로드맵 새 버전 저장" }));

    expect(onChange).toHaveBeenCalledWith("step-one", { title: "" });
    expect(onChange).toHaveBeenCalledWith("step-one", { priority: "low" });
    expect(onChange).toHaveBeenCalledWith("step-one", { estimatedEffort: "medium" });
    expect(onMove).toHaveBeenCalledWith("step-one", 1);
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("adds and deletes steps and edits node and dependency references", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onAdd = vi.fn();
    const onDelete = vi.fn();
    render(<RoadmapPanel nodes={mockPlanningResult.nodes} roadmap={roadmap} status="ready" editStatus="idle"
      editErrorMessage={null} errorMessage={null} onChange={onChange} onMove={vi.fn()} onSave={vi.fn()} onAdd={onAdd} onDelete={onDelete} />);
    await user.click(screen.getByRole("button", { name: "단계 추가" }));
    expect(onAdd).toHaveBeenCalledOnce();
    const card = within(screen.getAllByRole("listitem")[0]!);
    await user.click(card.getByText(/관련 노드 ·/));
    await user.click(card.getByLabelText(`1단계 관련 노드: ${mockPlanningResult.nodes[0]!.label}`));
    expect(onChange).toHaveBeenCalledWith("step-one", { componentNodeIds: ["node-api", mockPlanningResult.nodes[0]!.id] });
    await user.click(card.getByText(/선행 단계 ·/));
    await user.click(card.getByLabelText("1단계 선행 단계: API 구현"));
    expect(onChange).toHaveBeenCalledWith("step-one", { dependsOn: ["step-two"] });
    await user.click(card.getByRole("button", { name: "요구사항 정리 단계 삭제" }));
    expect(onDelete).toHaveBeenCalledWith("step-one");
  });

  it("can save an empty roadmap and add its first step", () => {
    render(<RoadmapPanel nodes={[]} roadmap={[]} status="ready" editStatus="dirty" editErrorMessage={null}
      errorMessage={null} onChange={vi.fn()} onMove={vi.fn()} onSave={vi.fn()} onAdd={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/단계가 없습니다/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "단계 추가" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "로드맵 새 버전 저장" })).toBeEnabled();
  });
});
