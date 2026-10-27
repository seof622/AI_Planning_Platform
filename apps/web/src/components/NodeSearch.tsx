"use client";

import { useState } from "react";
import type { ComponentNode } from "@ai-planning-platform/shared";
import type { NodeTypeFilter } from "../lib/graphNavigation";
import { nodeTypeLabels } from "../lib/planningLabels";
import { WorkspacePopover } from "./WorkspacePopover";
import { WorkspaceIcon } from "./WorkspaceIcon";

interface NodeSearchProps {
  query: string;
  type: NodeTypeFilter;
  matches: ComponentNode[];
  total: number;
  disabled: boolean;
  onChange: (query: string, type: NodeTypeFilter) => void;
  onNavigate: (nodeId: string) => void;
}

export function NodeSearch({ query, type, matches, total, disabled, onChange, onNavigate }: NodeSearchProps) {
  const [closeSequence, setCloseSequence] = useState(0);
  const active = query.trim() !== "" || type !== "all";
  return <WorkspacePopover label="노드 검색" trigger={<WorkspaceIcon name="search" />}
    className={`node-search${active ? " node-search--active" : ""}`} closeOn={closeSequence ? String(closeSequence) : null}>
    <label className="form-field"><span className="form-field__label">이름</span>
      <input type="search" aria-label="노드 이름 검색" placeholder="노드 이름" value={query} disabled={disabled}
        onChange={(event) => onChange(event.target.value, type)} />
    </label>
    <label className="form-field"><span className="form-field__label">유형</span>
      <select aria-label="노드 유형 필터" value={type} disabled={disabled} onChange={(event) => onChange(query, event.target.value as NodeTypeFilter)}>
        <option value="all">모든 유형</option>
        {Object.entries(nodeTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <div className="node-search__status"><span role="status" aria-label="노드 검색 결과">{matches.length} / {total}개 노드</span>
      {active ? <button className="button" type="button" disabled={disabled} onClick={() => onChange("", "all")}>필터 초기화</button> : null}
    </div>
    {matches.length ? <ul className="node-search__results" aria-label="노드 검색 결과 목록">
      {matches.map((node) => <li key={node.id}><button type="button" disabled={disabled} aria-label={`검색 결과 ${node.label} 위치로 이동`}
        onClick={() => { setCloseSequence((value) => value + 1); onNavigate(node.id); }}>
        <span>{node.label || "이름 없음"}</span><span className="pill">{nodeTypeLabels[node.type]}</span>
      </button></li>)}
    </ul> : <p className="graph-edit-panel__hint">검색 결과가 없습니다.</p>}
  </WorkspacePopover>;
}
