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
  ai: { accent: "#e67e22", border: "#f5c99d", background: "#fff7ef" },
  api: { accent: "#2f80ed", border: "#c7ddf7", background: "#f3f8ff" },
  data: { accent: "#3d8b8b", border: "#b9dddd", background: "#f3fbfb" },
  feature: { accent: "#4f8a5b", border: "#c9dfce", background: "#f5fbf6" },
  infra: { accent: "#667382", border: "#d4dbe3", background: "#f8fafc" },
  system: { accent: "#7161ef", border: "#d6d1fb", background: "#f7f5ff" },
  ui: { accent: "#c45f0c", border: "#f5c99d", background: "#fff7ef" },
  workflow: { accent: "#b45375", border: "#edc8d5", background: "#fff6f9" },
};

export const dependencyColors: Record<DependencyType, string> = {
  blocks: "#b42318",
  feeds: "#e67e22",
  related: "#667382",
  requires: "#2f80ed",
};
