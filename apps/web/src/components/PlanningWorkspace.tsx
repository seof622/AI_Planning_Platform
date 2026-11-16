"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { DependencyType } from "@ai-planning-platform/shared";
import { getSelectedNode, hasUnappliedInput, usePlanningStore } from "../store/planningStore";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { PlanningCanvas } from "./PlanningCanvas";
import { PlanningHistoryPanel } from "./PlanningHistoryPanel";
import { ProjectPanel } from "./ProjectPanel";
import { RequirementPanel } from "./RequirementPanel";
import { RoadmapPanel } from "./RoadmapPanel";
import { RoadmapStepDetailPanel } from "./RoadmapStepDetailPanel";
import { GraphEditPanel } from "./GraphEditPanel";
import { PlanningExportPanel } from "./PlanningExportPanel";
import { versionLabel } from "../lib/planningVersions";
import { WorkspaceIcon } from "./WorkspaceIcon";
import { PlanningOperationFeedback } from "./PlanningOperationFeedback";
import { operationLabels } from "../lib/planningOperations";
import { getGenerationBlocker } from "../lib/planningInput";
import { defaultWorkspaceLayout, layoutLimits, useWorkspaceLayout } from "../lib/useWorkspaceLayout";
import { WorkspaceResizeHandle } from "./WorkspaceResizeHandle";
import type { NodeFocusRequest } from "../lib/graphNavigation";
import { useWorkspacePositionPersistence } from "../lib/useWorkspacePositionPersistence";
import { ContentReaderProvider } from "./ContentReader";

const statusLabels = {
  empty: "비어 있음",
  error: "오류",
  idle: "대기 중",
  loading: "불러오는 중",
  ready: "준비 완료",
};

export function PlanningWorkspace() {
  useWorkspacePositionPersistence();
  const [nodeFocusRequest, setNodeFocusRequest] = useState<NodeFocusRequest | null>(null);
  const [connectionType, setConnectionType] = useState<DependencyType>("requires");
  const { layout, setLayout, resetLayout } = useWorkspaceLayout();
  const bodyRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const {
    editPast,
    editFuture,
    undoEdit,
    redoEdit,
    finishEditGroup,
    canvasRevision,
    workspaceRestore,
    pendingOperation,
    failedOperation,
    retryFailedOperation,
    dismissOperationError,
    briefSaveStatus,
    briefSaveErrorMessage,
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
    loadPlanningHistory,
    modelErrorMessage,
    models,
    modelStatus,
    planningBrief,
    planningHistory,
    planningResult,
    resultPlanningBrief,
    projectErrorMessage,
    projects,
    projectStatus,
    requirementText,
    resetToEmpty,
    restoreSelectedPlanningResult,
    saveGraphEdits,
    saveCurrentPlanningBrief,
    selectedNodeId,
    selectedRoadmapStepId,
    selectedModel,
    selectedPlanningResultId,
    selectedProjectId,
    selectNode,
    selectRoadmapStep,
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
  const view = planningResult ? layout.view : "both";
  function resize(key: "inputWidth" | "detailWidth" | "graphShare", value: number) {
    setLayout((previous) => ({ ...previous, [key]: value }));
  }
  const selectedStep = planningResult?.roadmap.find((step) => step.id === selectedRoadmapStepId) ?? null;
  const hasUnsavedEdits = graphEditStatus !== "idle";
  const isBusy = status === "loading" || graphEditStatus === "saving";
  function navigateToNode(nodeId: string) {
    if (isBusy || !planningResult?.nodes.some((node) => node.id === nodeId)) return;
    selectNode(nodeId);
    if (view === "roadmap") setLayout((previous) => ({ ...previous, view: "both" }));
    setNodeFocusRequest((previous) => ({ nodeId, revision: canvasRevision, sequence: (previous?.sequence ?? 0) + 1 }));
  }
  const resultStatus = planningResult && (pendingOperation || failedOperation) ? (planningResult.nodes.length ? "ready" : "empty") : status;
  const loadingLabel = pendingOperation?.kind === "generate" ? "생성 중"
    : pendingOperation?.kind === "restore" ? "복원 중"
    : graphEditStatus === "saving" ? "저장 중" : "불러오는 중";
  const retryBlocker = failedOperation?.kind === "generate" ? getGenerationBlocker({
    hasSelectedProject: selectedProjectId !== null, modelStatus, models, selectedModel, requirementText, planningBrief,
  }) : null;
  const feedback = pendingOperation || failedOperation ? <PlanningOperationFeedback
    pending={pendingOperation} failed={failedOperation} errorMessage={errorMessage} hasResult={planningResult !== null}
    retryDisabled={isBusy || retryBlocker !== null} retryDisabledReason={retryBlocker}
    onRetry={async () => { if (confirmDiscardEdits()) await retryFailedOperation(); }}
    onDismiss={dismissOperationError}
  /> : undefined;
  const inputNeedsGeneration = hasUnappliedInput({
    planningResult, resultPlanningBrief, requirementText, planningBrief, selectedModel,
  });
  const resultSaveLabel = graphEditStatus === "saving" ? "결과 편집 저장 중…"
    : graphEditStatus === "error" ? "결과 편집 저장 실패"
    : hasUnsavedEdits ? "결과 편집 미저장" : "결과 편집 저장됨";
  function confirmDiscardEdits(): boolean {
    return !hasUnsavedEdits || window.confirm("미저장 편집이 있습니다. 변경 내용을 버리고 이동할까요?");
  }
  function focusPlanningInput() {
    if (selectedProjectId) {
      setLayout((previous) => ({ ...previous, inputCollapsed: false }));
      requestAnimationFrame(() => document.getElementById("planning-requirement")?.focus());
    } else {
      const newProject = document.querySelector<HTMLDetailsElement>(".project-panel__new");
      if (newProject) {
        newProject.open = true;
        newProject.querySelector<HTMLInputElement>("input")?.focus();
      }
    }
  }
  function closeStepEditor() {
    const id = selectedRoadmapStepId;
    selectRoadmapStep(null);
    requestAnimationFrame(() => {
      if (view === "graph") document.querySelector<HTMLButtonElement>('[aria-label="로드맵 집중 보기"]')?.focus({ preventScroll: true });
      else if (id) document.querySelector<HTMLButtonElement>(`.roadmap-step[data-step-id="${CSS.escape(id)}"] > button`)?.focus({ preventScroll: true });
    });
  }
  function confirmRemoveStep(stepId: string) {
    const step = planningResult?.roadmap.find((item) => item.id === stepId);
    if (!step) return;
    const dependents = planningResult?.roadmap.filter((item) => item.dependsOn.includes(stepId)) ?? [];
    const impact = dependents.length > 0
      ? `\n다음 단계의 선행 조건에서 이 단계가 제거됩니다: ${dependents.map((item) => item.title).join(", ")}` : "";
    if (window.confirm(`“${step.title}” 단계를 삭제할까요?${impact}\n남은 단계 번호를 다시 매깁니다. 과거 버전은 유지됩니다.`)) removeRoadmapStep(stepId);
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
      isViewingHistoricalResult ||
      briefSaveStatus !== "dirty"
    ) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void saveCurrentPlanningBrief();
    }, 600);
    return () => window.clearTimeout(timeoutId);
  }, [
    planningBrief,
    briefSaveStatus,
    isViewingHistoricalResult,
    projectStatus,
    requirementText,
    saveCurrentPlanningBrief,
    selectedModel,
    selectedProjectId,
  ]);

  return (
    <ContentReaderProvider scope={`${selectedProjectId}:${canvasRevision}`} nodes={planningResult?.nodes ?? []}
      roadmap={planningResult?.roadmap ?? []} disabled={isBusy} onEdit={(kind, id) => {
        if (kind === "node") selectNode(id); else selectRoadmapStep(id);
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>("#workspace-detail input")?.focus({ preventScroll: true }));
      }}>
    <main className="workspace" onBlurCapture={finishEditGroup} onKeyDown={(event) => {
      if (event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      if (key === "y" || event.shiftKey) redoEdit(); else undoEdit();
    }} style={{
      "--input-width": `${layout.inputWidth}px`, "--detail-width": `${layout.detailWidth}px`,
      "--graph-size": `${layout.graphShare}fr`, "--roadmap-size": `${100 - layout.graphShare}fr`,
    } as CSSProperties}>
      <header className="workspace__header">
        <div className="workspace__brand">
          <span className="workspace__brand-mark" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 6h12M6 6v12m0 0h12" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="3" width="6" height="6" rx="2" fill="currentColor"/><rect x="15" y="3" width="6" height="6" rx="2" fill="currentColor"/><rect x="3" y="15" width="6" height="6" rx="2" fill="currentColor"/><rect x="15" y="15" width="6" height="6" rx="2" fill="currentColor"/></svg>
          </span>
          <div><h1>플랜노트</h1></div>
        </div>
        <ProjectPanel
          errorMessage={failedOperation?.kind === "projects" || failedOperation?.kind === "project" ? null : projectErrorMessage}
          isLoading={projectStatus === "loading" || isBusy}
          onCreate={async (title) => { if (confirmDiscardEdits()) await createAndSelectProject(title); }}
          onSelect={async (id) => { if (confirmDiscardEdits()) await selectProject(id); }}
          projects={projects}
          selectedProjectId={selectedProjectId}
        />
        <div className="workspace__header-status">
          {planningResult ? <span role="status" aria-label={resultSaveLabel} title={resultSaveLabel} className={`workspace__save-state${hasUnsavedEdits ? " workspace__save-state--dirty" : ""}`}>
            <WorkspaceIcon name={graphEditStatus === "saving" ? "refresh" : graphEditStatus === "error" ? "alert" : hasUnsavedEdits ? "circle" : "check"} />
            <span aria-hidden="true">{graphEditStatus === "saving" ? "저장 중" : graphEditStatus === "error" ? "저장 실패" : hasUnsavedEdits ? "미저장" : "저장됨"}</span>
          </span> : null}
          {status !== "ready" ? <span className={`workspace__status workspace__status--${status}`}><span aria-hidden="true" />{pendingOperation ? loadingLabel : statusLabels[status]}</span> : null}
        </div>
      </header>
      <div className="workspace__toolbar" aria-label="계획 작업 도구">
          <PlanningHistoryPanel
            errorMessage={historyErrorMessage}
            onRetry={selectedProjectId && historyStatus === "error" ? () => loadPlanningHistory(selectedProjectId) : undefined}
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
          <div className="workspace__view-tools">
            <div className="workspace__view-switch" role="group" aria-label="편집 기록">
              <button className="button button--icon" type="button" aria-label="편집 실행 취소" title="편집 실행 취소 (Ctrl/⌘+Z)"
                aria-keyshortcuts="Control+Z Meta+Z" disabled={isBusy || !editPast.length} onClick={undoEdit}>
                <WorkspaceIcon name="undo" />
              </button>
              <button className="button button--icon" type="button" aria-label="편집 다시 실행" title="편집 다시 실행 (Ctrl+Y / Ctrl/⌘+Shift+Z)"
                aria-keyshortcuts="Control+Y Control+Shift+Z Meta+Shift+Z" disabled={isBusy || !editFuture.length} onClick={redoEdit}>
                <WorkspaceIcon name="redo" />
              </button>
            </div>
            <button className="button button--icon" type="button" aria-controls="workspace-input"
              aria-expanded={!layout.inputCollapsed} aria-label={layout.inputCollapsed ? "계획 입력 펼치기" : "계획 입력 접기"}
              title={layout.inputCollapsed ? "계획 입력 펼치기" : "계획 입력 접기"}
              onClick={() => setLayout((previous) => ({ ...previous, inputCollapsed: !previous.inputCollapsed }))}>
              <WorkspaceIcon name="sidebar" />
            </button>
            <div className="workspace__view-switch" role="group" aria-label="결과 보기">
              {([
                ["both", "함께 보기", "panels"], ["graph", "그래프 집중 보기", "graph"], ["roadmap", "로드맵 집중 보기", "list"],
              ] as const).map(([mode, label, icon]) => <button className="button button--icon" type="button" key={mode}
                aria-label={label} title={label} aria-pressed={view === mode} disabled={!planningResult}
                onClick={() => setLayout((previous) => ({ ...previous, view: mode }))}>
                <WorkspaceIcon name={icon} />
              </button>)}
            </div>
            <button className="button button--icon" type="button" aria-label="화면 배치 초기화" title="화면 배치 초기화" onClick={resetLayout}>
              <WorkspaceIcon name="refresh" />
            </button>
          </div>
          <PlanningExportPanel
            result={planningResult}
            projectTitle={projects.find((project) => project.id === selectedProjectId)?.title}
            version={selectedPlanningResultId ? versionLabel(planningHistory, selectedPlanningResultId) : undefined}
            hasUnsavedEdits={hasUnsavedEdits}
            disabled={isBusy || status !== "ready"}
          />
      </div>
      <div ref={bodyRef} className={`workspace__body${layout.inputCollapsed ? " workspace__body--input-collapsed" : ""}`}>
        <div className="workspace__sidebar" id="workspace-input" hidden={layout.inputCollapsed}>
          <RequirementPanel
            briefSaveStatus={briefSaveStatus}
            briefSaveErrorMessage={briefSaveErrorMessage}
            onRetryBriefSave={saveCurrentPlanningBrief}
            hasResult={planningResult !== null}
            hasUnappliedInput={inputNeedsGeneration}
            isViewingHistoricalResult={isViewingHistoricalResult}
            generatedModel={planningResult?.metadata.model}
            hasSelectedProject={selectedProjectId !== null}
            isLoading={isBusy}
            loadingLabel={loadingLabel}
            onRetryModels={loadModels}
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
        {!layout.inputCollapsed ? <WorkspaceResizeHandle label="입력 패널 너비 조절" orientation="vertical" controls="workspace-input"
          className="workspace__input-resize" value={layout.inputWidth} min={layoutLimits.inputWidth[0]} max={layoutLimits.inputWidth[1]}
          onChange={(value) => resize("inputWidth", value)} onReset={() => resize("inputWidth", defaultWorkspaceLayout.inputWidth)}
          fromPointer={(event) => event.clientX - (bodyRef.current?.getBoundingClientRect().left ?? 0) - 8} /> : null}
        <div ref={canvasAreaRef} className={`workspace__canvas-area${selectedNode || selectedStep ? " workspace__canvas-area--detail-open" : ""}`}>
          <div ref={resultsRef} className={`workspace__results workspace__results--${view}`}>
          <PlanningCanvas
            positionProjectId={selectedProjectId}
            workspaceRestore={workspaceRestore}
            resultRevision={canvasRevision}
            focusRequest={nodeFocusRequest}
            relatedNodeIds={selectedStep?.componentNodeIds}
            onNavigateNode={navigateToNode}
            hidden={view === "roadmap"}
            feedback={view !== "roadmap" ? feedback : undefined}
            errorMessage={errorMessage}
            onStart={focusPlanningInput}
            hasSelectedProject={selectedProjectId !== null}
            toolbar={planningResult && resultStatus === "ready" ? (
              <GraphEditPanel edgeCount={planningResult.edges.length} connectionType={connectionType}
                onConnectionTypeChange={setConnectionType} disabled={isBusy}
                canSave={versionConflict === null && (graphEditStatus === "dirty" || graphEditStatus === "error")}
                errorMessage={graphEditErrorMessage} onAddNode={addNode} onSave={saveGraphEdits} />
            ) : null}
            disabled={isBusy}
            onConnect={(source, target) => addEdge(source, target, connectionType)}
            onUpdateEdge={updateEdge}
            onRemoveEdge={removeEdge}
            onMoveNode={updateNodePosition}
            onSelectNode={selectNode}
            result={planningResult}
            selectedNodeId={selectedNodeId}
            status={resultStatus}
          />
          {view === "both" ? <WorkspaceResizeHandle label="그래프와 로드맵 높이 조절" orientation="horizontal" controls="planning-canvas planning-roadmap"
            value={layout.graphShare} min={layoutLimits.graphShare[0]} max={layoutLimits.graphShare[1]} step={2}
            onChange={(value) => resize("graphShare", value)} onReset={() => resize("graphShare", defaultWorkspaceLayout.graphShare)}
            fromPointer={(event) => {
              const box = resultsRef.current!.getBoundingClientRect();
              return (event.clientY - box.top - 8) / (box.height - 16) * 100;
            }} /> : null}
          <RoadmapPanel
            positionProjectId={selectedProjectId}
            resultRevision={canvasRevision}
            workspaceRestore={workspaceRestore}
            nodes={planningResult?.nodes}
            selectedNodeId={selectedNodeId}
            onNavigateNode={navigateToNode}
            hidden={view === "graph"}
            feedback={view === "roadmap" ? feedback : undefined}
            disabled={isBusy}
            loadingLabel={pendingOperation ? operationLabels[pendingOperation.kind] : undefined}
            selectedStepId={selectedRoadmapStepId}
            onSelect={selectRoadmapStep}
            onAdd={addRoadmapStep}
            saveBlocked={versionConflict !== null}
            editErrorMessage={graphEditErrorMessage}
            editStatus={graphEditStatus}
            errorMessage={errorMessage}
            onSave={saveGraphEdits}
            roadmap={planningResult?.roadmap ?? []}
            status={resultStatus}
          />
          </div>
          {selectedNode || selectedStep ? <WorkspaceResizeHandle label="상세 편집 너비 조절" orientation="vertical" controls="workspace-detail"
            className="workspace__detail-resize" value={layout.detailWidth} min={layoutLimits.detailWidth[0]} max={layoutLimits.detailWidth[1]}
            onChange={(value) => resize("detailWidth", value)} onReset={() => resize("detailWidth", defaultWorkspaceLayout.detailWidth)}
            fromPointer={(event) => (canvasAreaRef.current?.getBoundingClientRect().right ?? 0) - event.clientX - 8} /> : null}
          <RoadmapStepDetailPanel
            onNavigateNode={navigateToNode}
            key={selectedStep?.id}
            step={selectedStep} roadmap={planningResult?.roadmap ?? []} nodes={planningResult?.nodes ?? []}
            disabled={isBusy} saveBlocked={versionConflict !== null} editStatus={graphEditStatus}
            errorMessage={graphEditErrorMessage} onClose={closeStepEditor}
            onChange={updateRoadmapStep} onMove={moveRoadmapStep} onDelete={confirmRemoveStep} onSave={saveGraphEdits}
          />
          <NodeDetailPanel
            disabled={isBusy}
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
    </ContentReaderProvider>
  );
}
