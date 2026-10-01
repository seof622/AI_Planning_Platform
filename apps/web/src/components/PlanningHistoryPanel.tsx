"use client";

import type { PlanningResult, PlanningResultHistoryItem } from "@ai-planning-platform/shared";
import { versionLabel, versionOrigin } from "../lib/planningVersions";
import { VersionComparisonPanel } from "./VersionComparisonPanel";

interface PlanningHistoryPanelProps {
  errorMessage: string | null;
  history: PlanningResultHistoryItem[];
  isLoading: boolean;
  onRestore: () => Promise<void>;
  onSelect: (resultId: string) => Promise<void>;
  selectedResultId: string | null;
  projectId: string | null;
  result: PlanningResult | null;
  hasUnsavedEdits: boolean;
  versionConflict: "edit" | "restore" | null;
  conflictLatestResultId: string | null;
  onResolveConflict: (keepEdits: boolean) => Promise<void>;
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
  projectId, result, hasUnsavedEdits, versionConflict, conflictLatestResultId, onResolveConflict,
}: PlanningHistoryPanelProps) {
  const selected = history.find((item) => item.id === selectedResultId);
  const sourceId = selected?.restoredFromResultId ?? selected?.editedFromResultId;
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
              {versionLabel(history, item.id)} · {versionOrigin(item)} · {formatGeneratedAt(item.createdAt)}
            </option>
          ))}
        </select>
      ) : (
        <p>{isLoading ? "이력을 불러오는 중" : "아직 생성된 계획이 없습니다."}</p>
      )}
      {selectedResultId ? (
        <>
          {selected ? <p className="history-panel__origin">{versionLabel(history, selected.id)} · {versionOrigin(selected)}{sourceId ? ` · ${versionLabel(history, sourceId)}에서 ${selected.restoredFromResultId ? "복원" : "편집"}` : ""}</p> : null}
          <p className="history-panel__summary">
            {history.find((item) => item.id === selectedResultId)?.summary}
          </p>
          <p>
            모델: {selected?.model ?? "기록 없음"} ·{" "}
            Prompt:{" "}
            {history.find((item) => item.id === selectedResultId)
              ?.promptVersion ?? "기록 없음"}
          </p>
        </>
      ) : null}
      {versionConflict ? (
        <div className="version-conflict" role="alert">
          <p>최신 버전이 변경되어 {versionConflict === "edit" ? "저장" : "복원"}을 중단했습니다. 현재 화면은 유지됩니다.</p>
          {versionConflict === "edit" ? <button type="button" disabled={isLoading} onClick={() => {
            if (window.confirm("다른 버전의 변경을 병합하지 않고 현재 편집본 전체를 새 최신 버전으로 저장할까요?")) void onResolveConflict(true);
          }}>내 편집본으로 새 버전 저장</button> : null}
          <button type="button" disabled={isLoading} onClick={() => {
            if (!hasUnsavedEdits || window.confirm("미저장 편집을 버리고 최신 버전을 불러올까요?")) void onResolveConflict(false);
          }}>최신 버전 불러오기</button>
        </div>
      ) : null}
      {projectId && selectedResultId && result && history.length > 1 ? (
        <VersionComparisonPanel key={`${projectId}/${selectedResultId}`} projectId={projectId} selectedResultId={selectedResultId} result={result} history={history} hasUnsavedEdits={hasUnsavedEdits} conflictLatestResultId={conflictLatestResultId} />
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
                versionConflict === "restore"
                  ? "확인한 최신 버전 위에 선택한 결과와 당시 입력 내용을 새 버전으로 복원할까요?"
                  : hasUnsavedEdits
                  ? "미저장 편집을 버리고 선택한 결과와 당시 입력 내용을 새 최신 버전으로 복원할까요?"
                  : "선택한 결과와 당시 입력 내용을 새 최신 버전으로 복원할까요?",
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
