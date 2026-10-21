import { describe, expect, it } from "vitest";
import { defaultWorkspaceLayout, readWorkspaceLayout } from "./useWorkspaceLayout";

describe("workspace layout preferences", () => {
  it("recovers safely from missing, malformed or unrelated stored data", () => {
    for (const raw of [null, "broken", "null", "[]", "42", '{"view":"unknown","inputCollapsed":"yes","inputWidth":"huge"}']) {
      expect(readWorkspaceLayout(raw)).toEqual(defaultWorkspaceLayout);
    }
  });

  it("restores known settings and bounds dimensions so stale preferences cannot break the layout", () => {
    expect(readWorkspaceLayout(JSON.stringify({ view: "roadmap", inputCollapsed: true, inputWidth: 9999, detailWidth: -10, graphShare: 0, ignored: true })))
      .toEqual({ view: "roadmap", inputCollapsed: true, inputWidth: 420, detailWidth: 280, graphShare: 25 });
    expect(readWorkspaceLayout('{"view":"graph","inputWidth":350,"detailWidth":360,"graphShare":65}'))
      .toEqual({ ...defaultWorkspaceLayout, view: "graph", inputWidth: 350, detailWidth: 360, graphShare: 65 });
  });
});
