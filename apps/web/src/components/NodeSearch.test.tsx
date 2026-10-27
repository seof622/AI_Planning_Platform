import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { mockPlanningResult } from "@ai-planning-platform/shared";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { filterGraphNodes, type NodeTypeFilter } from "../lib/graphNavigation";
import { NodeSearch } from "./NodeSearch";

function SearchFixture({ onNavigate, disabled = false }: { onNavigate: (id: string) => void; disabled?: boolean }) {
  const [filter, setFilter] = useState({ query: "", type: "all" as NodeTypeFilter });
  return <NodeSearch {...filter} disabled={disabled} total={mockPlanningResult.nodes.length}
    matches={filterGraphNodes(mockPlanningResult.nodes, filter.query, filter.type)} onNavigate={onNavigate}
    onChange={(query, type) => setFilter({ query, type })} />;
}

describe("NodeSearch", () => {
  afterEach(cleanup);
  it("combines filters, reports empty results and clears them before navigating by ID", async () => {
    const navigate = vi.fn();
    render(<SearchFixture onNavigate={navigate} />);
    await userEvent.click(screen.getByLabelText("노드 검색"));
    await userEvent.type(screen.getByLabelText("노드 이름 검색"), "API");
    await userEvent.selectOptions(screen.getByLabelText("노드 유형 필터"), "ui");
    expect(screen.getByText("검색 결과가 없습니다.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "필터 초기화" }));
    expect(screen.getByLabelText("노드 이름 검색")).toHaveValue("");
    expect(screen.getAllByRole("button", { name: /^검색 결과/ })).toHaveLength(mockPlanningResult.nodes.length);
    await userEvent.click(screen.getByRole("button", { name: "검색 결과 계획 API 위치로 이동" }));
    expect(navigate).toHaveBeenCalledWith("node-planning-api");
    expect(screen.getByLabelText("노드 이름 검색")).not.toBeVisible();
  });
  it("disables filtering and navigation during a pending operation", async () => {
    const navigate = vi.fn();
    render(<SearchFixture onNavigate={navigate} disabled />);
    await userEvent.click(screen.getByLabelText("노드 검색"));
    expect(screen.getByLabelText("노드 이름 검색")).toBeDisabled();
    expect(screen.getByLabelText("노드 유형 필터")).toBeDisabled();
    expect(screen.getByRole("button", { name: "검색 결과 계획 API 위치로 이동" })).toBeDisabled();
  });
});
