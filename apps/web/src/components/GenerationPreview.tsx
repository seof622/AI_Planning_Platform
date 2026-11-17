import { DesignWorkshop, RoadmapWorkshop } from "./GenerationWorkshop";

// Decorative scenes illustrate a pending request, never partial planning data.
export function GenerationPreview({ kind }: { kind: "graph" | "roadmap" }) {
  return <div className={`generation-preview generation-preview--${kind}`} aria-hidden="true">
    {kind === "graph" ? <DesignWorkshop /> : <RoadmapWorkshop />}
    <p><span className="generation-preview__activity"><i /><i /><i /></span>
      {kind === "graph" ? "아이디어를 연결해 구조를 설계하고 있어요" : "실행할 일을 순서대로 조립하고 있어요"}
    </p>
  </div>;
}
