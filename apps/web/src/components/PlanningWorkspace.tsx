"use client";

import { useEffect, useState } from "react";
import type { DependencyType } from "@ai-planning-platform/shared";
import { getSelectedNode, usePlanningStore } from "../store/planningStore";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { PlanningCanvas } from "./PlanningCanvas";
import { PlanningHistoryPanel } from "./PlanningHistoryPanel";
import { ProjectPanel } from "./ProjectPanel";
import { RequirementPanel } from "./RequirementPanel";
import { RoadmapPanel } from "./RoadmapPanel";
import { GraphEditPanel } from "./GraphEditPanel";
import { PlanningExportPanel } from "./PlanningExportPanel";
import { versionLabel } from "../lib/planningVersions";

const statusLabels = {
  empty: "비어 있음",
  error: "오류",
  idle: "대기 중",
  loading: "불러오는 중",
  ready: "준비 완료",
};

export function PlanningWorkspace() {
  const [connectionType, setConnectionType] = useState<DependencyType>("requires");
  const {
    addNode,
    removeNode,
    addEdge,
    removeEdge,
    updateEdge,
    createAndSelectProject,
    errorMessage,
    generateResult,
    graphEditErrorMessage,
    graphEditStatus,
    versionConflict,
    conflictLatestResultId,
    resolveVersionConflict,
    historyErrorMessage,
    historyStatus,
    isViewingHistoricalResult,
    loadModels,
    loadProjects,
    modelErrorMessage,
    models,
    modelStatus,
    planningBrief,
    planningHistory,
    planningResult,
    projectErrorMessage,
    projects,
    projectStatus,
    requirementText,
    resetToEmpty,
    restoreSelectedPlanningResult,
    saveGraphEdits,
    saveCurrentPlanningBrief,
    selectedNodeId,
    selectedModel,
    selectedPlanningResultId,
    selectedProjectId,
    selectNode,
    selectPlanningResult,
    selectProject,
    setErrorState,
    setPlanningBriefField,
    setRequirementText,
    setSelectedModel,
    status,
    updateNode,
    updateNodePosition,
    updateRoadmapStep,
    moveRoadmapStep,
    addRoadmapStep,
    removeRoadmapStep,
  } = usePlanningStore();

  const selectedNode = getSelectedNode(planningResult, selectedNodeId);
  const hasUnsavedEdits = graphEditStatus !== "idle";
  const isBusy = status === "loading" || graphEditStatus === "saving";
  function confirmDiscardEdits(): boolean {
    return !hasUnsavedEdits || window.confirm("미저장 편집이 있습니다. 변경 내용을 버리고 이동할까요?");
  }

  useEffect(() => {
    if (!hasUnsavedEdits) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedEdits]);

  useEffect(() => {
    void (async () => {
      await loadModels();
      await loadProjects();
    })();
  }, [loadModels, loadProjects]);

  useEffect(() => {
    if (
      !selectedProjectId ||
      projectStatus !== "ready" ||
      isViewingHistoricalResult
    ) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void saveCurrentPlanningBrief();
    }, 600);
    return () => window.clearTimeout(timeoutId);
  }, [
    planningBrief,
    isViewingHistoricalResult,
    projectStatus,
    requirementText,
    saveCurrentPlanningBrief,
    selectedModel,
    selectedProjectId,
  ]);

  return (
    <main className="workspace">
      <header className="workspace__header">
        <div className="workspace__brand">
          <span className="workspace__brand-mark" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 6h12M6 6v12m0 0h12" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="3" width="6" height="6" rx="2" fill="currentColor"/><rect x="15" y="3" width="6" height="6" rx="2" fill="currentColor"/><rect x="3" y="15" width="6" height="6" rx="2" fill="currentColor"/><rect x="15" y="15" width="6" height="6" rx="2" fill="currentColor"/></svg>
          </span>
          <div><h1>플랜노트</h1><span>생각에서 실행까지</span></div>
        </div>
        <div className="workspace__breadcrumb"><span>내 작업 공간</span><span aria-hidden="true">/</span><strong>{projects.find((project) => project.id === selectedProjectId)?.title ?? "새로운 계획"}</strong></div>
        <div className="workspace__header-status">
          {planningResult ? <span className={`workspace__save-state${hasUnsavedEdits ? " workspace__save-state--dirty" : ""}`}>{graphEditStatus === "saving" ? "저장 중…" : hasUnsavedEdits ? "저장하지 않은 변경" : "저장된 상태"}</span> : null}
          <span className={`workspace__status workspace__status--${status}`}><span aria-hidden="true" />{statusLabels[status]}</span>
        </div>
      </header>
      <div className="workspace__body">
        <div className="workspace__sidebar">
          <ProjectPanel
            errorMessage={projectErrorMessage}
            isLoading={projectStatus === "loading" || isBusy}
            onCreate={async (title) => { if (confirmDiscardEdits()) await createAndSelectProject(title); }}
            onSelect={async (id) => { if (confirmDiscardEdits()) await selectProject(id); }}
            projects={projects}
            selectedProjectId={selectedProjectId}
          />
          <PlanningHistoryPanel
            errorMessage={historyErrorMessage}
            history={planningHistory}
            isLoading={historyStatus === "loading" || isBusy}
            onRestore={restoreSelectedPlanningResult}
            onSelect={async (id) => { if (confirmDiscardEdits()) await selectPlanningResult(id); }}
            selectedResultId={selectedPlanningResultId}
            projectId={selectedProjectId}
            result={planningResult}
            hasUnsavedEdits={hasUnsavedEdits}
            versionConflict={versionConflict}
            conflictLatestResultId={conflictLatestResultId}
            onResolveConflict={resolveVersionConflict}
          />
          {planningResult && status === "ready" ? (
            <GraphEditPanel edgeCount={planningResult.edges.length} connectionType={connectionType}
              onConnectionTypeChange={setConnectionType} disabled={isBusy}
              canSave={versionConflict === null && (graphEditStatus === "dirty" || graphEditStatus === "error")}
              errorMessage={graphEditErrorMessage} onAddNode={addNode} onSave={saveGraphEdits} />
          ) : null}
          <PlanningExportPanel
            result={planningResult}
            projectTitle={projects.find((project) => project.id === selectedProjectId)?.title}
            version={selectedPlanningResultId ? versionLabel(planningHistory, selectedPlanningResultId) : undefined}
            hasUnsavedEdits={hasUnsavedEdits}
            disabled={isBusy || status !== "ready"}
          />
          <RequirementPanel
            generatedModel={planningResult?.metadata.model}
            hasSelectedProject={selectedProjectId !== null}
            isLoading={isBusy}
            modelErrorMessage={modelErrorMessage}
            models={models}
            modelStatus={modelStatus}
            onGenerate={async () => { if (confirmDiscardEdits()) await generateResult(); }}
            onReset={() => { if (confirmDiscardEdits()) resetToEmpty(); }}
            onShowError={() =>
              setErrorState("AI 계획 결과를 생성하지 못했습니다.")
            }
            planningBrief={planningBrief}
            requirementText={requirementText}
            selectedModel={selectedModel}
            setPlanningBriefField={setPlanningBriefField}
            setRequirementText={setRequirementText}
            setSelectedModel={setSelectedModel}
          />
        </div>
        <div className={`workspace__canvas-area${selectedNode ? " workspace__canvas-area--node-selected" : ""}`}>
          <PlanningCanvas
            disabled={isBusy}
            onConnect={(source, target) => addEdge(source, target, connectionType)}
            onUpdateEdge={updateEdge}
            onRemoveEdge={removeEdge}
            onMoveNode={updateNodePosition}
            onSelectNode={selectNode}
            result={planningResult}
            selectedNodeId={selectedNodeId}
            status={status}
          />
          <RoadmapPanel
            nodes={planningResult?.nodes ?? []}
            onAdd={addRoadmapStep}
            onDelete={(stepId) => {
              const step = planningResult?.roadmap.find((item) => item.id === stepId);
              if (!step) return;
              const dependents = planningResult?.roadmap.filter((item) => item.dependsOn.includes(stepId)) ?? [];
              const impact = dependents.length > 0
                ? `\n다음 단계의 선행 조건에서 이 단계가 제거됩니다: ${dependents.map((item) => item.title).join(", ")}`
                : "";
              if (window.confirm(`“${step.title}” 단계를 삭제할까요?${impact}\n남은 단계 번호를 다시 매깁니다. 과거 버전은 유지됩니다.`)) removeRoadmapStep(stepId);
            }}
            saveBlocked={versionConflict !== null}
            editErrorMessage={graphEditErrorMessage}
            editStatus={graphEditStatus}
            errorMessage={errorMessage}
            onChange={updateRoadmapStep}
            onMove={moveRoadmapStep}
            onSave={saveGraphEdits}
            roadmap={planningResult?.roadmap ?? []}
            status={status}
          />
          <NodeDetailPanel
            saveBlocked={versionConflict !== null}
            editErrorMessage={graphEditErrorMessage}
            editStatus={graphEditStatus}
            node={selectedNode}
            onClose={() => selectNode(null)}
            canDelete={(planningResult?.nodes.length ?? 0) > 1}
            onDelete={() => {
              if (selectedNode && window.confirm(`“${selectedNode.label}” 노드를 삭제할까요? 연결과 로드맵의 해당 노드 참조도 함께 제거됩니다. 저장 전 변경이며 과거 버전은 유지됩니다.`)) {
                removeNode(selectedNode.id);
              }
            }}
            onChange={(changes) => {
              if (selectedNode) {
                updateNode(selectedNode.id, changes);
              }
            }}
            onSave={saveGraphEdits}
          />
        </div>
      </div>

    </main>
  );
}
