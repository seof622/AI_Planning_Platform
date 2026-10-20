import { describe, expect, it } from "vitest";
import { mockPlanningResult } from "@ai-planning-platform/shared";
import { createPlanningMarkdown, planningMarkdownFilename } from "./planningMarkdown";

describe("planning Markdown export", () => {
  it("exports edited content with readable references in roadmap order without changing the result", () => {
    const result = structuredClone(mockPlanningResult);
    result.nodes[0]!.label = "사용자가 편집한 노드";
    result.roadmap.reverse();
    const before = structuredClone(result);
    const markdown = createPlanningMarkdown({ result, version: "v2", hasUnsavedEdits: true });
    expect(markdown).toContain("- 버전: v2");
    expect(markdown).toContain("저장 전 편집 포함");
    expect(markdown).toContain("사용자 요구사항을 분석해 핵심 컴포넌트");
    expect(markdown).toContain("### 1. 사용자가 편집한 노드");
    expect(markdown).toContain("| 1\\. 사용자가 편집한 노드 |");
    const steps = [...result.roadmap].sort((a, b) => a.order - b.order);
    expect(markdown.indexOf(`### ${steps[0]!.order}. ${steps[0]!.title}`))
      .toBeLessThan(markdown.indexOf(`### ${steps[1]!.order}. ${steps[1]!.title}`));
    expect(markdown).toContain(`- 선행 단계: ${steps[0]!.order}\\. ${steps[0]!.title}`);
    expect(markdown).not.toContain(result.nodes[0]!.id);
    expect(result).toEqual(before);
  });

  it("keeps Markdown, HTML and multiline input as literal document content", () => {
    const result = structuredClone(mockPlanningResult);
    result.summary = "<script>alert('x')</script>\r\n# 가짜 제목\n![이미지](https://example.test/x.png)";
    result.nodes[0]!.label = "노드 | A\nB";
    const markdown = createPlanningMarkdown({ result, projectTitle: "제목\n# 주입" });
    expect(markdown).toContain("# 제목 \\# 주입");
    expect(markdown).toContain("&lt;script&gt;");
    expect(markdown).not.toContain("<script>");
    expect(markdown).toContain("  \n\\# 가짜 제목");
    expect(markdown).toContain("\\!\\[이미지\\]\\(https://example\\.test/x\\.png\\)");
    expect(markdown).toContain("노드 \\| A B");
  });

  it("handles missing optional content, empty roadmap and portable Korean filenames", () => {
    const result = { ...mockPlanningResult, project: undefined, requirement: undefined, edges: [], roadmap: [] };
    const markdown = createPlanningMarkdown({ result });
    expect(markdown).toContain("## 요구사항\n\n없음");
    expect(markdown).toContain("노드 연결이 없습니다.");
    expect(markdown).toContain("등록된 실행 단계가 없습니다.");
    expect(planningMarkdownFilename({ result })).toBe("계획-계획.md");
    expect(planningMarkdownFilename({ result, projectTitle: '한글/계획:초안?\n', version: "v2", hasUnsavedEdits: true }))
      .toBe("한글-계획-초안--계획-v2-편집중.md");
    expect(planningMarkdownFilename({ result, projectTitle: "CON" })).toBe("CON-계획.md");
    expect(planningMarkdownFilename({ result, projectTitle: " . " })).toBe("계획-계획.md");
  });
});
