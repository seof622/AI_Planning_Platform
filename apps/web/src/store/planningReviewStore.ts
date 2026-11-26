import { create } from "zustand";
import { sameReviewInput, validateInputFeedback, type PlanningReview, type PlanningReviewDetail,
  type ReviewExecutionResponse, type ReviewInput, type ReviewPreference } from "@ai-planning-platform/shared";
import { currentReviewInput, usePlanningStore } from "./planningStore";
import { getAIExecution, getPlanningReview, listPlanningReviews, PlanningApiError,
  recordPlanningDecision, reviewPlanningInput } from "../lib/planningClient";

type PendingReview = { projectId: string; input: ReviewInput; parentId: string | null; key: string };
type ReviewStatus = "idle" | "reviewing" | "ready" | "expired" | "uncertain" | "error" | "confirming";
interface ReviewState {
  projectId: string | null;
  review: PlanningReview | null;
  status: ReviewStatus;
  preference: ReviewPreference;
  error: string | null;
  historyError: string | null;
  pending: PendingReview | null;
  confirmationKey: string | null;
  open: boolean;
  mode: "review" | "history";
  history: PlanningReview[];
  historyLoading: boolean;
  detail: PlanningReviewDetail | null;
  syncProject: (projectId: string | null) => void;
  restoreLatest: () => Promise<void>;
  invalidate: () => void;
  setPreference: (preference: ReviewPreference) => void;
  startReview: () => Promise<void>;
  checkExecution: () => Promise<void>;
  selectModel: (model: string) => Promise<void>;
  confirmAndGenerate: () => Promise<void>;
  show: () => void;
  close: () => void;
  showHistory: (reviewId?: string) => Promise<void>;
  inspect: (reviewId: string) => Promise<void>;
}

let selectionQueue = Promise.resolve();
let generation = 0;
const message = (error: unknown) => error instanceof Error ? error.message : "입력 검토 요청을 처리하지 못했습니다.";

export function isCurrentReview(review: PlanningReview | null, preference: ReviewPreference): boolean {
  return review !== null && review.projectId === usePlanningStore.getState().selectedProjectId
    && sameReviewInput(review.input, currentReviewInput(usePlanningStore.getState(), preference));
}

export const usePlanningReviewStore = create<ReviewState>((set, get) => {
  function receive(response: ReviewExecutionResponse, pending: PendingReview) {
    if (get().projectId !== pending.projectId) return;
    if (response.run.status === "running") {
      set({ status: "uncertain", pending, error: "입력 검토가 진행 중입니다. 처리 상태를 확인해 주세요." });
      return;
    }
    if (response.run.status !== "succeeded" || !response.review?.feedback) {
      set({ review: response.review, status: "error", pending: null,
        error: response.run.errorMessage ?? "입력 검토를 완료하지 못했습니다." });
      return;
    }
    if (!validateInputFeedback(response.review.feedback)) {
      set({ status: "error", pending: null, error: "입력 검토 응답 형식을 확인하지 못했습니다. 다시 검토해 주세요." });
      return;
    }
    set({ review: response.review, pending: null, confirmationKey: null, error: null,
      status: isCurrentReview(response.review, get().preference) ? "ready" : "expired" });
  }
  return {
    projectId: null, review: null, status: "idle", preference: "balanced", error: null, historyError: null,
    pending: null, confirmationKey: null, open: false, mode: "review", history: [], historyLoading: false, detail: null,
    syncProject(projectId) {
      if (get().projectId === projectId) return;
      generation += 1;
      set({ projectId, review: null, status: "idle", preference: "balanced", error: null, historyError: null,
        pending: null, confirmationKey: null, open: false, history: [], detail: null, historyLoading: false });
    },
    async restoreLatest() {
      const projectId = get().projectId;
      const ticket = generation;
      if (!projectId || get().review || get().status !== "idle") return;
      try {
        const history = await listPlanningReviews(projectId);
        if (get().projectId !== projectId || ticket !== generation || get().status !== "idle") return;
        const latest = history[0] ?? null;
        if (latest && isCurrentReview(latest, latest.input.preference)) {
          const detail = await getPlanningReview(projectId, latest.id);
          if (get().projectId !== projectId || ticket !== generation || get().status !== "idle") return;
          const reviewRun = detail.runs.find((run) => run.kind === "review");
          const pending = reviewRun && !latest.feedback ? { projectId, input: latest.input, parentId: latest.parentReviewId, key: reviewRun.idempotencyKey } : null;
          set({ history, review: latest, preference: latest.input.preference, pending,
            status: latest.feedback ? "ready" : reviewRun?.status === "running" ? "uncertain" : "error" });
          const generationRun = [...detail.runs].reverse().find((run) => run.kind === "generation");
          const confirmation = detail.decisions.find((decision) => decision.id === generationRun?.confirmationId);
          if (generationRun && confirmation && generationRun.status !== "succeeded") {
            usePlanningStore.setState({ generationRun,
              confirmedGeneration: { confirmationId: confirmation.id, idempotencyKey: generationRun.idempotencyKey,
                input: confirmation.snapshot.input, selectedModel: confirmation.selectedModel },
              failedOperation: { kind: "generate", projectId, startedAt: new Date(generationRun.createdAt).getTime() },
              errorMessage: generationRun.errorMessage ?? "진행 중인 생성이 있습니다. 다시 시도로 같은 실행 상태를 확인해 주세요." });
          }
        } else set({ history });
      } catch { /* Review history failure does not block existing projects or results. */ }
    },
    invalidate() {
      const state = get();
      if (state.review && state.status === "ready" && !isCurrentReview(state.review, state.preference)) {
        set({ status: "expired", confirmationKey: null });
      }
    },
    setPreference(preference) {
      if (get().preference === preference) return;
      set({ preference, confirmationKey: null });
      get().invalidate();
      usePlanningStore.setState({ confirmedGeneration: null });
    },
    async startReview() {
      if (["reviewing", "confirming", "uncertain"].includes(get().status)) { get().show(); return; }
      const planning = usePlanningStore.getState();
      const projectId = planning.selectedProjectId;
      if (!projectId || planning.pendingOperation || !planning.requirementText.trim()) return;
      const ticket = ++generation;
      set({ open: true, mode: "review", status: "reviewing", error: null, confirmationKey: null });
      usePlanningStore.setState({ confirmedGeneration: null });
      try {
        await planning.saveCurrentPlanningBrief();
        if (get().projectId !== projectId || ticket !== generation) return;
        const input = currentReviewInput(usePlanningStore.getState(), get().preference);
        const pending = { projectId, input, parentId: get().review?.id ?? null, key: crypto.randomUUID() };
        set({ pending });
        const response = await reviewPlanningInput(projectId, input, pending.key, pending.parentId);
        if (ticket === generation) receive(response, pending);
      } catch (error) {
        if (get().projectId !== projectId || ticket !== generation) return;
        const definite = error instanceof PlanningApiError && error.status < 500;
        set({ status: definite || !get().pending ? "error" : "uncertain", error: message(error),
          ...(definite ? { pending: null } : {}) });
      }
    },
    async checkExecution() {
      const pending = get().pending;
      if (!pending || get().status === "reviewing") return;
      const ticket = generation;
      set({ status: "reviewing", error: null });
      try {
        let response: ReviewExecutionResponse;
        try { response = await getAIExecution(pending.projectId, pending.key, "review"); }
        catch (error) {
          if (!(error instanceof PlanningApiError) || error.status !== 404) throw error;
          response = await reviewPlanningInput(pending.projectId, pending.input, pending.key, pending.parentId);
        }
        if (ticket === generation) receive(response, pending);
      } catch (error) {
        if (ticket === generation && get().projectId === pending.projectId) set({ status: "uncertain", error: message(error) });
      }
    },
    async selectModel(model) {
      const state = get();
      usePlanningStore.getState().setSelectedModel(model);
      set({ confirmationKey: null });
      if (!state.review || !isCurrentReview(state.review, state.preference)) return;
      const review = state.review;
      const key = crypto.randomUUID();
      selectionQueue = selectionQueue.catch(() => {}).then(async () => {
        await recordPlanningDecision(review.projectId, review, model, "selection", key);
      });
      try {
        await selectionQueue;
        if (get().projectId === review.projectId) set({ error: null });
      } catch (error) {
        if (get().projectId === review.projectId) set({ error: `모델 선택 이력 저장 실패: ${message(error)}. 최종 확인 시 선택 모델을 다시 기록합니다.` });
      }
    },
    async confirmAndGenerate() {
      const state = get();
      const planning = usePlanningStore.getState();
      if (state.status !== "ready" || !state.review || !isCurrentReview(state.review, state.preference)
        || planning.pendingOperation || !planning.models.some((model) => model.id === planning.selectedModel)) return;
      const review = state.review;
      const selectedModel = planning.selectedModel;
      const key = state.confirmationKey ?? crypto.randomUUID();
      set({ status: "confirming", error: null, confirmationKey: key });
      try {
        await selectionQueue.catch(() => {});
        await planning.saveCurrentPlanningBrief();
        if (!isCurrentReview(review, get().preference) || usePlanningStore.getState().selectedModel !== selectedModel) {
          set({ status: "expired", error: "입력이 변경됐습니다. 다시 검토해 주세요." }); return;
        }
        const decision = await recordPlanningDecision(review.projectId, review, selectedModel, "confirmation", key);
        if (!isCurrentReview(review, get().preference) || get().projectId !== review.projectId) return;
        set({ open: false, status: "ready" });
        await usePlanningStore.getState().generateResult({ confirmationId: decision.id, idempotencyKey: crypto.randomUUID(),
          input: review.input, selectedModel });
      } catch (error) {
        if (get().projectId !== review.projectId) return;
        set({ status: error instanceof PlanningApiError && error.status === 409 ? "expired" : "ready", error: message(error) });
      }
    },
    show() { set({ open: true, mode: "review" }); },
    close() { if (get().status !== "confirming") set({ open: false }); },
    async showHistory(reviewId) {
      const projectId = get().projectId;
      if (!projectId) return;
      set({ open: true, mode: "history", historyLoading: true, historyError: null, detail: null });
      try {
        const history = await listPlanningReviews(projectId);
        if (get().projectId !== projectId) return;
        set({ history, historyLoading: false });
        if (reviewId) await get().inspect(reviewId);
      } catch (error) {
        if (get().projectId === projectId) set({ historyLoading: false, historyError: message(error) });
      }
    },
    async inspect(reviewId) {
      const projectId = get().projectId;
      if (!projectId) return;
      const ticket = ++generation;
      set({ historyLoading: true, detail: null, historyError: null });
      try {
        const detail = await getPlanningReview(projectId, reviewId);
        if (get().projectId === projectId && ticket === generation) set({ detail, historyLoading: false });
      } catch (error) {
        if (get().projectId === projectId && ticket === generation) set({ historyLoading: false, historyError: message(error) });
      }
    },
  };
});
