"use client";

import { useEffect } from "react";
import { getSelectedNode, usePlanningStore } from "../store/planningStore";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { PlanningCanvas } from "./PlanningCanvas";
import { RequirementPanel } from "./RequirementPanel";
import { RoadmapPanel } from "./RoadmapPanel";

export function PlanningWorkspace() {
  const {
    errorMessage,
    loadMockResult,
    planningResult,
    requirementText,
    resetToEmpty,
    selectedNodeId,
    selectNode,
    setErrorState,
    setRequirementText,
    status,
  } = usePlanningStore();

  useEffect(() => {
    void loadMockResult();
  }, [loadMockResult]);

  const selectedNode = getSelectedNode(planningResult, selectedNodeId);

  return (
    <main className="workspace">
      <header className="workspace__header">
        <div>
          <h1 className="workspace__title">AI Planning Platform</h1>
          <p className="workspace__summary">
            {planningResult?.summary ??
              "Turn a product idea into a component graph and implementation roadmap."}
          </p>
        </div>
        <div className="workspace__status">Status: {status}</div>
      </header>

      <div className="workspace__grid">
        <RequirementPanel
          isLoading={status === "loading"}
          onLoadMock={loadMockResult}
          onReset={resetToEmpty}
          onShowError={() => setErrorState("Mock planning result failed to load.")}
          requirementText={requirementText}
          setRequirementText={setRequirementText}
        />
        <PlanningCanvas
          onSelectNode={selectNode}
          result={planningResult}
          selectedNodeId={selectedNodeId}
          status={status}
        />
        <NodeDetailPanel node={selectedNode} />
        <RoadmapPanel
          errorMessage={errorMessage}
          roadmap={planningResult?.roadmap ?? []}
          status={status}
        />
      </div>
    </main>
  );
}
