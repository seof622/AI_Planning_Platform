"use client";

import { useEffect, useRef, useState } from "react";
import { operationFailureLabels, operationLabels, type PlanningOperation } from "../lib/planningOperations";
import { WorkspaceIcon } from "./WorkspaceIcon";

interface PlanningOperationFeedbackProps {
  pending: PlanningOperation | null;
  failed: PlanningOperation | null;
  errorMessage: string | null;
  hasResult: boolean;
  retryDisabled: boolean;
  retryDisabledReason?: string | null;
  onRetry: () => Promise<void>;
  onDismiss: () => void;
}

export function PlanningOperationFeedback({ pending, failed, errorMessage, hasResult, retryDisabled, retryDisabledReason, onRetry, onDismiss }: PlanningOperationFeedbackProps) {
  const [now, setNow] = useState(() => Date.now());
  const noticeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (failed) noticeRef.current?.focus();
  }, [failed]);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);
  const elapsed = pending ? Math.max(0, Math.floor((now - pending.startedAt) / 1000)) : 0;
  const elapsedText = elapsed < 60 ? `${elapsed}초` : `${Math.floor(elapsed / 60)}분 ${elapsed % 60}초`;
  if (!pending && !failed) return null;
  return <div ref={noticeRef} tabIndex={-1} className={`operation-feedback${hasResult ? " operation-feedback--inline" : ""}${failed ? " operation-feedback--error" : ""}`}
    role={pending ? "status" : "alert"} aria-label={pending ? operationLabels[pending.kind] : operationFailureLabels[failed!.kind]}>
    <div className="operation-feedback__heading">
      <WorkspaceIcon name={pending ? "refresh" : "alert"} className={pending ? "workspace-icon--spin" : ""} />
      <strong>{pending ? operationLabels[pending.kind] : operationFailureLabels[failed!.kind]}</strong>
      {pending ? <span className="operation-feedback__elapsed" role="timer" aria-label="경과 시간" aria-live="off">{elapsedText}</span> : null}
      {hasResult && failed ? <span className="operation-feedback__kept">기존 결과 유지</span> : null}
      {hasResult && failed ? <button className="button button--icon" type="button" aria-label="오류 안내 닫기" title="오류 안내 닫기" onClick={onDismiss}><WorkspaceIcon name="close" /></button> : null}
    </div>
    {failed ? <>
      <p className="operation-feedback__message">{errorMessage ?? "요청을 처리하지 못했습니다. 다시 시도해 주세요."}</p>
      <button className="button" type="button" disabled={retryDisabled} title={retryDisabledReason ?? "실패한 작업 다시 시도"} onClick={() => void onRetry()}>
        <WorkspaceIcon name="refresh" />다시 시도
      </button>
    </> : null}
  </div>;
}
