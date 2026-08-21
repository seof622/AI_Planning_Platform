import type { AIModelOption } from "@ai-planning-platform/shared";
import { describe, expect, it } from "vitest";
import { recommendModel } from "./modelRecommendation";

const models: AIModelOption[] = [
  {
    cost: "low",
    description: "efficient",
    id: "gpt-5.6-luna",
    label: "Luna",
    quality: "high",
    recommendedFor: "volume",
    speed: "fast",
  },
  {
    cost: "medium",
    description: "balanced",
    id: "gpt-5.6-terra",
    label: "Terra",
    quality: "high",
    recommendedFor: "projects",
    speed: "balanced",
  },
  {
    cost: "high",
    description: "quality",
    id: "gpt-5.6-sol",
    label: "Sol",
    quality: "highest",
    recommendedFor: "decisions",
    speed: "deliberate",
  },
];

describe("recommendModel", () => {
  it("prioritizes quality for quality-focused plans", () => {
    expect(recommendModel(models, "project", "quality")?.model.id).toBe(
      "gpt-5.6-sol",
    );
  });

  it("prioritizes efficiency for speed-focused plans", () => {
    expect(recommendModel(models, "project", "speed")?.model.id).toBe(
      "gpt-5.6-luna",
    );
  });

  it("uses only models supplied by the server", () => {
    expect(recommendModel([models[1]!], "decision", "quality")?.model.id).toBe(
      "gpt-5.6-terra",
    );
  });

  it("returns no recommendation for an empty catalog", () => {
    expect(recommendModel([], "daily", "speed")).toBeNull();
  });
});
