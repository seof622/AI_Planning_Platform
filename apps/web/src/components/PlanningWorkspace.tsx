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
          <h1 className="workspace__title">AI 계획 플랫폼</h1>
          <p className="workspace__summary">
            {planningResult?.summary ??
              "제품 아이디어를 컴포넌트 그래프와 구현 로드맵으로 전환합니다."}
          </p>
        </div>
        <div className="workspace__status">상태: {statusLabels[status]}</div>
      </header>

      <div className="workspace__grid">
        <RequirementPanel
          isLoading={status === "loading"}
          onLoadMock={loadMockResult}
          onReset={resetToEmpty}
          onShowError={() => setErrorState("목업 계획 결과를 불러오지 못했습니다.")}
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
