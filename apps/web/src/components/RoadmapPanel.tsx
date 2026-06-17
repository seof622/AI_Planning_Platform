"use client";

import type { RoadmapStep } from "@ai-planning-platform/shared";
import { effortLabels, priorityLabels } from "../lib/planningLabels";
import type { PlanningStatus } from "../store/planningStore";

interface RoadmapPanelProps {
  errorMessage: string | null;
  roadmap: RoadmapStep[];
  status: PlanningStatus;
}

export function RoadmapPanel({ errorMessage, roadmap, status }: RoadmapPanelProps) {
  const sortedRoadmap = [...roadmap].sort((left, right) => left.order - right.order);

  return (
    <section className="roadmap" aria-label="계획 로드맵">
      <div className="roadmap__header">
        <h2 className="roadmap__title">로드맵</h2>
        <span className="pill">{sortedRoadmap.length}단계</span>
      </div>

      {status === "error" ? (
        <StatusViewCopy
          title="로드맵을 사용할 수 없음"
          copy={errorMessage ?? "계획 결과를 불러올 수 없습니다."}
        />
      ) : null}

      {status === "empty" ? (
        <StatusViewCopy
          title="아직 로드맵이 없음"
          copy="목업 계획 결과를 불러와 구현 단계를 확인하세요."
        />
      ) : null}

      {status === "loading" ? (
        <StatusViewCopy title="로드맵 불러오는 중" copy="목업 계획 단계를 준비하고 있습니다." />
      ) : null}

      {status === "ready" ? (
        <ol className="roadmap__steps">
          {sortedRoadmap.map((step) => (
            <li className="roadmap-step" key={step.id}>
              <div className="roadmap-step__topline">
                <span className="roadmap-step__order">{step.order}</span>
                <span className={`pill pill--${step.priority}`}>
                  {priorityLabels[step.priority]} / {effortLabels[step.estimatedEffort]}
                </span>
              </div>
              <h3 className="roadmap-step__title">{step.title}</h3>
              <p className="roadmap-step__description">{step.description}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function StatusViewCopy({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="status-view">
      <div className="status-view__box">
        <h3 className="status-view__title">{title}</h3>
        <p className="status-view__copy">{copy}</p>
      </div>
    </div>
  );
}
