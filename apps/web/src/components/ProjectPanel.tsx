"use client";

import { FormEvent, useState } from "react";
import type { Project } from "@ai-planning-platform/shared";
import { WorkspacePopover } from "./WorkspacePopover";

interface ProjectPanelProps {
  errorMessage: string | null;
  isLoading: boolean;
  onCreate: (title: string) => Promise<void>;
  onSelect: (projectId: string) => Promise<void>;
  projects: Project[];
  selectedProjectId: string | null;
}

export function ProjectPanel({
  errorMessage,
  isLoading,
  onCreate,
  onSelect,
  projects,
  selectedProjectId,
}: ProjectPanelProps) {
  const [title, setTitle] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) {
      return;
    }
    await onCreate(nextTitle);
    setTitle("");
  }

  return (
    <section className="project-panel" aria-label="프로젝트 관리">
      <label className="project-panel__select-label" htmlFor="project-select">
        프로젝트
      </label>
      <select
        id="project-select"
        className="project-panel__select"
        disabled={isLoading || projects.length === 0}
        value={selectedProjectId ?? ""}
        onChange={(event) => void onSelect(event.target.value)}
      >
        {projects.length === 0 ? (
          <option value="">프로젝트를 만들어 주세요</option>
        ) : null}
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.title}
          </option>
        ))}
      </select>

      <WorkspacePopover label="새 프로젝트" className="project-panel__new" closeOn={selectedProjectId}>
        <form className="project-panel__create" onSubmit={handleSubmit}>
          <input
            aria-label="새 프로젝트 이름"
            disabled={isLoading}
            placeholder="새 프로젝트 이름"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button disabled={isLoading || title.trim().length === 0} type="submit">
            추가
          </button>
        </form>
        {errorMessage ? <p className="form-field__error" role="alert">{errorMessage}</p> : null}
      </WorkspacePopover>

      {errorMessage ? (
        <p className="project-panel__error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
