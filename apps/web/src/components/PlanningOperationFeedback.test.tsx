import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanningOperationFeedback } from "./PlanningOperationFeedback";

describe("PlanningOperationFeedback", () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("shows the operation and real elapsed time without a fabricated progress percentage", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T00:00:00Z"));
    const props = { failed: null, errorMessage: null, hasResult: true, retryDisabled: false, onRetry: vi.fn(), onDismiss: vi.fn() };
    const { rerender } = render(<PlanningOperationFeedback {...props}
      pending={{ kind: "generate", projectId: "project", startedAt: Date.now() }} />);
    expect(screen.getByRole("status", { name: "AI 생성 중" })).toBeVisible();
    expect(screen.getByRole("timer")).toHaveTextContent("0초");
    act(() => { vi.advanceTimersByTime(65_000); });
    expect(screen.getByRole("timer")).toHaveTextContent("1분 5초");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    rerender(<PlanningOperationFeedback {...props}
      pending={{ kind: "version", projectId: "project", resultId: "older", startedAt: Date.now() }} />);
    expect(screen.getByRole("status", { name: "버전 불러오는 중" })).toBeVisible();
    expect(screen.getByRole("timer")).toHaveTextContent("0초");
  });

  it("explains the retained result and offers explicit retry and dismissal", async () => {
    const retry = vi.fn();
    const dismiss = vi.fn();
    render(<PlanningOperationFeedback pending={null} failed={{ kind: "generate", projectId: "project", startedAt: 0 }}
      errorMessage="연결이 끊겼습니다." hasResult retryDisabled={false} onRetry={retry} onDismiss={dismiss} />);
    expect(screen.getByRole("alert", { name: "AI 생성 실패" })).toHaveTextContent("기존 결과 유지");
    expect(screen.getByText("연결이 끊겼습니다.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(retry).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "오류 안내 닫기" }));
    expect(dismiss).toHaveBeenCalledOnce();
  });
});
