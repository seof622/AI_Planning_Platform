"use client";

import type { PlanningStatus } from "../store/planningStore";

interface StatusViewProps {
  status: PlanningStatus;
}

const statusCopy: Record<PlanningStatus, { title: string; copy: string }> = {
  empty: {
    title: "불러온 그래프 없음",
    copy: "요구사항 패널에서 목업 계획 그래프를 불러오세요.",
  },
  error: {
    title: "그래프를 불러올 수 없음",
    copy: "계획 결과를 사용할 수 없습니다. 목업 그래프를 다시 불러오세요.",
  },
  idle: {
    title: "작업 공간 준비 중",
    copy: "계획 캔버스를 초기화하고 있습니다.",
  },
  loading: {
    title: "그래프 불러오는 중",
    copy: "목업 계획 결과를 준비하고 있습니다.",
  },
  ready: {
    title: "그래프 준비 완료",
    copy: "노드를 선택해 상세 정보를 확인하세요.",
  },
};

export function StatusView({ status }: StatusViewProps) {
  const content = statusCopy[status];

  return (
    <div className="status-view">
      <div className="status-view__box">
        <h2 className="status-view__title">{content.title}</h2>
        <p className="status-view__copy">{content.copy}</p>
      </div>
    </div>
  );
}
