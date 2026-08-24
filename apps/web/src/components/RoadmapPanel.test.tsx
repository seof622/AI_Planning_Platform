import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
        onChange={onChange}
        onMove={onMove}
        onSave={onSave}
        roadmap={roadmap}
        status="ready"
      />,
    );

    await user.clear(screen.getByLabelText("1단계 제목"));
    await user.type(screen.getByLabelText("1단계 제목"), "범위 정의");
    await user.selectOptions(screen.getByLabelText("1단계 예상 작업량"), "medium");
    await user.click(screen.getByRole("button", { name: "요구사항 정리 뒤로 이동" }));
    await user.click(screen.getByRole("button", { name: "로드맵 새 버전 저장" }));

    expect(onChange).toHaveBeenCalledWith("step-one", { title: "" });
    expect(onChange).toHaveBeenCalledWith("step-one", { estimatedEffort: "medium" });
    expect(onMove).toHaveBeenCalledWith("step-one", 1);
    expect(onSave).toHaveBeenCalledOnce();
  });
});
