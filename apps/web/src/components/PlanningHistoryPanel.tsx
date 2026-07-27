"use client";

import type { PlanningResultHistoryItem } from "@ai-planning-platform/shared";

interface PlanningHistoryPanelProps {
  errorMessage: string | null;
  history: PlanningResultHistoryItem[];
  isLoading: boolean;
  onRestore: () => Promise<void>;
  onSelect: (resultId: string) => Promise<void>;
  selectedResultId: string | null;
}

function formatGeneratedAt(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PlanningHistoryPanel({
  errorMessage,
  history,
  isLoading,
  onSelect,
  onRestore,
  selectedResultId,
}: PlanningHistoryPanelProps) {
  return (
    <section className="history-panel" aria-label="계획 생성 이력">
      <div className="history-panel__header">
        <h2>생성 이력</h2>
        <span>{history.length}</span>
      </div>
      {history.length > 0 ? (
        <select
          aria-label="계획 버전"
          disabled={isLoading}
          value={selectedResultId ?? ""}
          onChange={(event) => void onSelect(event.target.value)}
        >
          {history.map((item, index) => (
            <option key={item.id} value={item.id}>
              {index === 0 ? "최신 · " : ""}
              {formatGeneratedAt(item.createdAt)} · {item.model ?? "모델 미상"}
            </option>
          ))}
        </select>
      ) : (
        <p>{isLoading ? "이력을 불러오는 중" : "아직 생성된 계획이 없습니다."}</p>
      )}
      {selectedResultId ? (
        <>
          <p className="history-panel__summary">
            {history.find((item) => item.id === selectedResultId)?.summary}
          </p>
          <p>
            Prompt:{" "}
            {history.find((item) => item.id === selectedResultId)
              ?.promptVersion ?? "기록 없음"}
          </p>
        </>
      ) : null}
      {selectedResultId && selectedResultId !== history[0]?.id ? (
        <button
          className="history-panel__restore"
          disabled={
            isLoading ||
            !history.find((item) => item.id === selectedResultId)?.canRestore
          }
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "선택한 결과와 당시 입력 내용을 새 최신 버전으로 복원할까요?",
              )
            ) {
              void onRestore();
            }
          }}
        >
          {history.find((item) => item.id === selectedResultId)?.canRestore
            ? "이 버전 복원"
            : "Brief 스냅샷 없음"}
        </button>
      ) : null}
      {errorMessage ? (
        <p className="history-panel__error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
