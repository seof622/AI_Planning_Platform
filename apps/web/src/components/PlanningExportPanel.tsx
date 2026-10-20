"use client";

import { useState } from "react";
import type { PlanningResult } from "@ai-planning-platform/shared";
import { downloadPlanningMarkdown } from "../lib/planningMarkdown";

interface PlanningExportPanelProps {
  result: PlanningResult | null;
  projectTitle?: string;
  version?: string;
  hasUnsavedEdits: boolean;
  disabled: boolean;
}

export function PlanningExportPanel({ result, projectTitle, version, hasUnsavedEdits, disabled }: PlanningExportPanelProps) {
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="export-panel" aria-label="계획 내보내기">
      <h2>내보내기</h2>
      <p>선택한 결과의 요구사항, 요약, 노드·연결과 로드맵을 문서로 저장합니다.</p>
      <button className="button" type="button" disabled={disabled || !result} onClick={() => {
        if (!result) return;
        setError(null);
        try { downloadPlanningMarkdown({ result, projectTitle, version, hasUnsavedEdits }); }
        catch { setError("파일을 내려받지 못했습니다. 다시 시도해 주세요."); }
      }}>Markdown 내보내기</button>
      {hasUnsavedEdits && result ? <p>저장 전 그래프·로드맵 편집도 포함됩니다.</p> : null}
      {error ? <p className="export-panel__error" role="alert">{error}</p> : null}
    </section>
  );
}
