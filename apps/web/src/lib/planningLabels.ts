import type {
  ComponentNodeType,
  DependencyType,
  EffortSize,
  Priority,
} from "@ai-planning-platform/shared";

export const nodeTypeLabels: Record<ComponentNodeType, string> = {
  ai: "AI",
  api: "API",
  data: "데이터",
  feature: "기능",
  infra: "인프라",
  system: "시스템",
  ui: "UI",
  workflow: "워크플로",
};

export const priorityLabels: Record<Priority, string> = {
  high: "높음",
  low: "낮음",
  medium: "보통",
};

export const effortLabels: Record<EffortSize, string> = {
  large: "큼",
  medium: "보통",
  small: "작음",
};

export const dependencyLabels: Record<DependencyType, string> = {
  blocks: "차단",
  feeds: "전달",
  related: "관련",
  requires: "필요",
};

export const nodeTypeColors: Record<
  ComponentNodeType,
  { accent: string; border: string; background: string }
> = {
  ai: { accent: "#7c3aed", border: "#c4b5fd", background: "#f5f3ff" },
  api: { accent: "#2563eb", border: "#bfdbfe", background: "#eff6ff" },
  data: { accent: "#0891b2", border: "#a5f3fc", background: "#ecfeff" },
  feature: { accent: "#0f766e", border: "#99f6e4", background: "#f0fdfa" },
  infra: { accent: "#475569", border: "#cbd5e1", background: "#f8fafc" },
  system: { accent: "#4f46e5", border: "#c7d2fe", background: "#eef2ff" },
  ui: { accent: "#c2410c", border: "#fed7aa", background: "#fff7ed" },
  workflow: { accent: "#be123c", border: "#fecdd3", background: "#fff1f2" },
};

export const dependencyColors: Record<DependencyType, string> = {
  blocks: "#b42318",
  feeds: "#0f766e",
  related: "#64748b",
  requires: "#2563eb",
};
