"use client";

import { useEffect } from "react";
import { getSelectedNode, usePlanningStore } from "../store/planningStore";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { PlanningCanvas } from "./PlanningCanvas";
import { RequirementPanel } from "./RequirementPanel";
import { RoadmapPanel } from "./RoadmapPanel";

const statusLabels = {
  empty: "비어 있음",
  error: "오류",
  idle: "대기 중",
  loading: "불러오는 중",
  ready: "준비 완료",
};

export function PlanningWorkspace() {
  const {
    errorMessage,
    loadMockResult,
    planningBrief,
    planningResult,
    requirementText,
    resetToEmpty,
    selectedNodeId,
    selectNode,
    setErrorState,
    setPlanningBriefField,
    setRequirementText,
    status,
  } = usePlanningStore();

  useEffect(() => {
    void loadMockResult();
  }, [loadMockResult]);

  const selectedNode = getSelectedNode(planningResult, selectedNodeId);

  return (
    <main className="workspace">
      <div className="workspace__body">
        <RequirementPanel
          isLoading={status === "loading"}
          onLoadMock={loadMockResult}
          onReset={resetToEmpty}
          onShowError={() => setErrorState("목업 계획 결과를 불러오지 못했습니다.")}
          planningBrief={planningBrief}
          requirementText={requirementText}
          setPlanningBriefField={setPlanningBriefField}
          setRequirementText={setRequirementText}
        />
        <div className="workspace__canvas-area">
          <PlanningCanvas
            onSelectNode={selectNode}
            result={planningResult}
            selectedNodeId={selectedNodeId}
            status={status}
          />
          <RoadmapPanel
            errorMessage={errorMessage}
            roadmap={planningResult?.roadmap ?? []}
            status={status}
          />
          <NodeDetailPanel node={selectedNode} />
        </div>
      </div>

      <div className={`workspace__status workspace__status--${status}`}>
        {statusLabels[status]}
      </div>
    </main>
  );
}
