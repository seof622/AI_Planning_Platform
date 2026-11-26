"use client";

import type { PlanningStatus } from "../store/planningStore";

interface StatusViewProps {
  status: PlanningStatus;
  errorMessage?: string | null;
  onStart?: () => void;
  hasSelectedProject?: boolean;
}

const statusCopy: Record<PlanningStatus, { title: string; copy: string }> = {
  empty: {
    title: "첫 계획을 만들어 보세요",
    copy: "주제를 입력하면 AI가 필요한 내용을 함께 확인해 드려요.",
  },
  error: {
    title: "오류",
    copy: "다시 시도하세요.",
  },
  idle: {
    title: "준비 중",
    copy: "",
  },
  loading: {
    title: "불러오는 중",
    copy: "",
  },
  ready: {
    title: "그래프",
    copy: "노드를 선택하세요.",
  },
};

export function StatusView({ status, errorMessage, onStart, hasSelectedProject = false }: StatusViewProps) {
  const content = statusCopy[status];

  return (
    <div className="status-view">
      <div className="status-view__box">
        <h2 className="status-view__title">{content.title}</h2>
        {status === "error" && errorMessage ? <p className="status-view__copy">{errorMessage}</p>
          : content.copy ? <p className="status-view__copy">{content.copy}</p> : null}
        {status === "empty" && onStart ? <button className="button" type="button" onClick={onStart}>{hasSelectedProject ? "계획 입력" : "프로젝트 만들기"}</button> : null}
      </div>
    </div>
  );
}
