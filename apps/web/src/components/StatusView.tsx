"use client";

import type { PlanningStatus } from "../store/planningStore";

interface StatusViewProps {
  status: PlanningStatus;
}

const statusCopy: Record<PlanningStatus, { title: string; copy: string }> = {
  empty: {
    title: "그래프 없음",
    copy: "계획을 생성하세요.",
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
    title: "생성 중",
    copy: "",
  },
  ready: {
    title: "그래프",
    copy: "노드를 선택하세요.",
  },
};

export function StatusView({ status }: StatusViewProps) {
  const content = statusCopy[status];

  return (
    <div className="status-view">
      <div className="status-view__box">
        <h2 className="status-view__title">{content.title}</h2>
        {content.copy ? <p className="status-view__copy">{content.copy}</p> : null}
      </div>
    </div>
  );
}
