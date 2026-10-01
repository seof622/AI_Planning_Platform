"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlanningResult, PlanningResultHistoryItem } from "@ai-planning-platform/shared";
import { getPlanningResult } from "../lib/planningClient";
import { comparePlanningResults, versionLabel, versionOrigin } from "../lib/planningVersions";

interface Props {
  projectId: string;
  selectedResultId: string;
  result: PlanningResult;
  history: PlanningResultHistoryItem[];
  hasUnsavedEdits: boolean;
  conflictLatestResultId: string | null;
}

export function VersionComparisonPanel({ projectId, selectedResultId, result, history, hasUnsavedEdits, conflictLatestResultId }: Props) {
  const selected = history.find((item) => item.id === selectedResultId);
  const index = history.findIndex((item) => item.id === selectedResultId);
  const defaultId = selected?.restoredFromResultId ?? selected?.editedFromResultId ?? history[index + 1]?.id ?? history.find((item) => item.id !== selectedResultId)?.id ?? "";
  const [comparisonId, setComparisonId] = useState(defaultId);
  const [comparison, setComparison] = useState<PlanningResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (conflictLatestResultId) setComparisonId(conflictLatestResultId);
  }, [conflictLatestResultId]);
  useEffect(() => {
    let cancelled = false;
    setComparison(null);
    setError(null);
    if (comparisonId) {
      void getPlanningResult(projectId, comparisonId).then((value) => {
        if (!cancelled) setComparison(value);
      }).catch((failure: unknown) => {
        if (!cancelled) setError(failure instanceof Error ? failure.message : "비교 버전을 불러오지 못했습니다.");
      });
    }
    return () => { cancelled = true; };
  }, [projectId, comparisonId]);
  const changes = useMemo(() => comparison ? comparePlanningResults(comparison, result) : [], [comparison, result]);
  return (
    <details className="version-comparison" open={conflictLatestResultId ? true : undefined}>
      <summary>버전 비교{comparison ? ` · ${changes.length}개 변경` : ""}</summary>
      <label className="form-field">
        <span className="form-field__label">비교 기준 버전</span>
        <select aria-label="비교 기준 버전" value={comparisonId} onChange={(event) => setComparisonId(event.target.value)}>
          {history.map((item) => <option key={item.id} value={item.id}>{versionLabel(history, item.id)} · {versionOrigin(item)}</option>)}
        </select>
      </label>
      <p>{versionLabel(history, comparisonId)} → 현재 화면 {versionLabel(history, selectedResultId)}{hasUnsavedEdits ? " (미저장 편집 포함)" : ""}</p>
      {error ? <p role="alert">{error}</p> : !comparison ? <p>비교 버전을 불러오는 중</p> : changes.length === 0 ? <p>계획 내용의 변경이 없습니다.</p> : (
        <ul className="version-change-list">
          {changes.map((change, changeIndex) => (
            <li key={changeIndex}>
              <strong>{change.group} · {change.item} · {change.field}</strong>
              <dl><dt>기준</dt><dd>{change.before}</dd><dt>현재</dt><dd>{change.after}</dd></dl>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
