"use client";

import { useId } from "react";
import { WorkspaceIcon } from "./WorkspaceIcon";

export function ResultSaveButton({ disabled, saving = false, onSave, className = "" }: {
  disabled: boolean;
  saving?: boolean;
  onSave: () => Promise<void>;
  className?: string;
}) {
  const descriptionId = useId();
  return <>
    <button className={`button button--primary ${className}`} type="button" disabled={disabled}
      aria-label={saving ? "저장 중" : "변경 내용을 새 버전으로 저장"} aria-describedby={descriptionId}
      title="노드·연결·로드맵 편집 전체를 새 버전으로 저장합니다." onClick={() => void onSave()}>
      <WorkspaceIcon name={saving ? "refresh" : "save"} className={saving ? "workspace-icon--spin" : ""} />
      {saving ? "저장 중" : "저장"}
    </button>
    <span className="sr-only" id={descriptionId}>노드·연결·로드맵 편집 전체 저장</span>
  </>;
}
