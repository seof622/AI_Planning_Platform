import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NodeDetailPanel } from "./NodeDetailPanel";

const node = {
  category: "Backend",
  description: "기존 설명",
  id: "node-api",
  label: "계획 API",
  position: { x: 0, y: 80 },
  priority: "high" as const,
  type: "api" as const,
};

describe("NodeDetailPanel", () => {
  it("edits node fields and saves a dirty graph", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <NodeDetailPanel
        editErrorMessage={null}
        editStatus="dirty"
        node={node}
        onChange={onChange}
        onSave={onSave}
      />,
    );

    await user.clear(screen.getByLabelText("Node 이름"));
    await user.type(screen.getByLabelText("Node 이름"), "편집된 API");
    await user.selectOptions(screen.getByLabelText("Node 우선순위"), "medium");
    await user.click(screen.getByRole("button", { name: "편집본 새 버전 저장" }));

    expect(onChange).toHaveBeenCalledWith({ label: "" });
    expect(onChange).toHaveBeenCalledWith({ priority: "medium" });
    expect(onSave).toHaveBeenCalledOnce();
  });
});
