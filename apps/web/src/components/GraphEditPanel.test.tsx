import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GraphEditPanel } from "./GraphEditPanel";

describe("GraphEditPanel", () => {
  it("chooses the type for drag connections and saves the graph", async () => {
    const user = userEvent.setup();
    const onConnectionTypeChange = vi.fn();
    const onSave = vi.fn();
    render(<GraphEditPanel edgeCount={3} connectionType="requires" onConnectionTypeChange={onConnectionTypeChange}
      disabled={false} canSave errorMessage={null} onAddNode={vi.fn()} onSave={onSave} />);
    await user.selectOptions(screen.getByLabelText("새 연결 유형"), "feeds");
    expect(onConnectionTypeChange).toHaveBeenCalledWith("feeds");
    await user.click(screen.getByRole("button", { name: "변경 내용을 새 버전으로 저장" }));
    expect(onSave).toHaveBeenCalledOnce();
  });
});
