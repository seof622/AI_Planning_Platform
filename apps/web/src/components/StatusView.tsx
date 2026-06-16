"use client";

import type { PlanningStatus } from "../store/planningStore";

interface StatusViewProps {
  status: PlanningStatus;
}

const statusCopy: Record<PlanningStatus, { title: string; copy: string }> = {
  empty: {
    title: "No graph loaded",
    copy: "Use the requirement panel to load the mock planning graph.",
  },
  error: {
    title: "Unable to load graph",
    copy: "The planning result is unavailable. Reload the mock graph to recover.",
  },
  idle: {
    title: "Preparing workspace",
    copy: "The planning canvas is initializing.",
  },
  loading: {
    title: "Loading graph",
    copy: "The mock planning result is being prepared.",
  },
  ready: {
    title: "Graph ready",
    copy: "Select a node to inspect details.",
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
