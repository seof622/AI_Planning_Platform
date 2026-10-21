"use client";

import { useState } from "react";
import type { PlanningResult } from "@ai-planning-platform/shared";
import { downloadPlanningMarkdown } from "../lib/planningMarkdown";
import { WorkspaceIcon } from "./WorkspaceIcon";

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
      <button className="button button--icon" type="button" aria-label="Markdown 내보내기" title="Markdown 내보내기 · 저장 전 편집도 포함됩니다." disabled={disabled || !result} onClick={() => {
        if (!result) return;
        setError(null);
        try { downloadPlanningMarkdown({ result, projectTitle, version, hasUnsavedEdits }); }
        catch { setError("파일을 내려받지 못했습니다. 다시 시도해 주세요."); }
      }}><WorkspaceIcon name="download" /></button>
      {error ? <p className="export-panel__error" role="alert">{error}</p> : null}
    </section>
  );
}
