import type { ReactNode } from "react";

const shapes = {
  search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
  expand: <><path d="M14 3h7v7M21 3l-8 8M10 21H3v-7m0 7 8-8" /></>,
  collapse: <><path d="M21 3l-8 8m0-7v7h7M3 21l8-8m0 7v-7H4" /></>,
  edit: <><path d="m15 5 4 4M4 20l4-1L21 6a2.8 2.8 0 0 0-4-4L4 15l-1 6Z" /></>,
  undo: <path d="m9 4-6 6 6 6M3 10h11a6 6 0 0 1 0 12" />,
  redo: <path d="m15 4 6 6-6 6M21 10H10a6 6 0 0 0 0 12" />,
  fit: <><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6" /><rect x="8" y="8" width="8" height="8" rx="1" /></>,
  panels: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 12h18" /></>,
  graph: <><rect x="3" y="8" width="5" height="8" rx="1" /><rect x="16" y="3" width="5" height="6" rx="1" /><rect x="16" y="15" width="5" height="6" rx="1" /><path d="M8 12h4V6h4m-4 6v6h4" /></>,
  list: <><path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1" /></>,
  sidebar: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z" /><path d="M7 3v6h10V3M7 21v-8h10v8" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10h.01" /></>,
  history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2" /></>,
  link: <><path d="m10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  cloud: <><path d="M7 18a5 5 0 1 1 .6-10A7 7 0 0 1 21 11a4 4 0 0 1-1 7" /><path d="m9 17 3 3 5-6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alert: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5m0 3h.01" /></>,
  refresh: <><path d="M3 10a9 9 0 0 1 15-6l3 3M21 3v5h-5M21 14a9 9 0 0 1-15 6l-3-3M3 21v-5h5" /></>,
  sparkle: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /><path d="M21 2v4m-2-2h4" /></>,
  map: <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16" /></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></>,
  circle: <circle cx="12" cy="12" r="7" />,
} satisfies Record<string, ReactNode>;

export type WorkspaceIconName = keyof typeof shapes;

export function WorkspaceIcon({ name, className = "" }: { name: WorkspaceIconName; className?: string }) {
  return <svg className={`workspace-icon ${className}`} width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {shapes[name]}
  </svg>;
}
