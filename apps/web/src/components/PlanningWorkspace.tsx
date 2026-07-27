"use client";

import { useEffect } from "react";
import { getSelectedNode, usePlanningStore } from "../store/planningStore";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { PlanningCanvas } from "./PlanningCanvas";
import { ProjectPanel } from "./ProjectPanel";
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
    createAndSelectProject,
    errorMessage,
    generateResult,
    loadModels,
    loadProjects,
    modelErrorMessage,
    models,
    modelStatus,
    planningBrief,
    planningResult,
    projectErrorMessage,
    projects,
    projectStatus,
    requirementText,
    resetToEmpty,
    saveCurrentPlanningBrief,
    selectedNodeId,
    selectedModel,
    selectedProjectId,
    selectNode,
    selectProject,
    setErrorState,
    setPlanningBriefField,
    setRequirementText,
    setSelectedModel,
    status,
  } = usePlanningStore();

  const selectedNode = getSelectedNode(planningResult, selectedNodeId);

  useEffect(() => {
    void (async () => {
      await loadModels();
      await loadProjects();
    })();
  }, [loadModels, loadProjects]);

  useEffect(() => {
    if (!selectedProjectId || projectStatus !== "ready") {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void saveCurrentPlanningBrief();
    }, 600);
    return () => window.clearTimeout(timeoutId);
  }, [
    planningBrief,
    projectStatus,
    requirementText,
    saveCurrentPlanningBrief,
    selectedModel,
    selectedProjectId,
  ]);

  return (
    <main className="workspace">
      <div className="workspace__body">
        <div className="workspace__sidebar">
          <ProjectPanel
            errorMessage={projectErrorMessage}
            isLoading={projectStatus === "loading"}
            onCreate={createAndSelectProject}
            onSelect={selectProject}
            projects={projects}
            selectedProjectId={selectedProjectId}
          />
          <RequirementPanel
            generatedModel={planningResult?.metadata.model}
            hasSelectedProject={selectedProjectId !== null}
            isLoading={status === "loading"}
            modelErrorMessage={modelErrorMessage}
            models={models}
            modelStatus={modelStatus}
            onGenerate={generateResult}
            onReset={resetToEmpty}
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
