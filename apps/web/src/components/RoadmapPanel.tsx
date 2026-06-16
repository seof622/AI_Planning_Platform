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
    <section className="roadmap" aria-label="Planning roadmap">
      <div className="roadmap__header">
        <h2 className="roadmap__title">Roadmap</h2>
        <span className="pill">{sortedRoadmap.length} steps</span>
      </div>

      {status === "error" ? (
        <StatusViewCopy
          title="Roadmap unavailable"
          copy={errorMessage ?? "The planning result could not be loaded."}
        />
      ) : null}

      {status === "empty" ? (
        <StatusViewCopy
          title="No roadmap yet"
          copy="Load the mock planning result to inspect implementation steps."
        />
      ) : null}

      {status === "loading" ? (
        <StatusViewCopy title="Loading roadmap" copy="Preparing the mock planning steps." />
      ) : null}

      {status === "ready" ? (
        <ol className="roadmap__steps">
          {sortedRoadmap.map((step) => (
            <li className="roadmap-step" key={step.id}>
              <div className="roadmap-step__topline">
                <span className="roadmap-step__order">{step.order}</span>
                <span className={`pill pill--${step.priority}`}>
                  {priorityLabels[step.priority]} · {effortLabels[step.estimatedEffort]}
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
