import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { ProjectTab } from "./project-detail";

export type NavItem = { value: ProjectTab; label: string; count?: number; icon: ReactNode };
export type NavGroup = { label?: string; items: NavItem[] };

const icon = (d: string) => (
  <svg aria-hidden viewBox="0 0 20 20" className="size-4.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export const NAV_ICONS = {
  overview: icon("M3 10.5 10 4l7 6.5M5 9v7h4v-4h2v4h4V9"),
  requirements: icon("M6 4h9M6 10h9M6 16h9M3 4h.01M3 10h.01M3 16h.01"),
  traceability: icon("M4 4h5v4H4zM11 12h5v4h-5zM6.5 8v6H11"),
  screens: icon("M3 4h14v10H3zM7 17h6M10 14v3"),
  worktrees: icon("M6 3v10M6 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM14 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM14 7c0 4-8 3-8 6"),
  activity: icon("M2 10h4l2-6 4 12 2-6h4"),
  tests: icon("M7 3h6M8 3v5l-4 8a1 1 0 0 0 1 1.5h10A1 1 0 0 0 16 16l-4-8V3"),
  pulls: icon("M6 3v14M6 3a2 2 0 1 0 0 .1M14 17a2 2 0 1 0 0-.1M14 15V8a3 3 0 0 0-3-3H9"),
  branches: icon("M5 4v12M15 4v4a4 4 0 0 1-4 4H5"),
  pipelines: icon("M3 6h4l2 4-2 4H3M11 6h6v8h-6"),
  rules: icon("M4 4h12v12H4zM7 8h6M7 12h4"),
  skills: icon("M10 2l2.2 4.6 5 .7-3.6 3.5.9 5L10 13.5 5.5 15.8l.9-5L2.8 7.3l5-.7z"),
  context: icon("M5 3h7l3 3v11H5zM12 3v3h3M8 10h4M8 13h4"),
  collab: icon("M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 17a5 5 0 0 1 10 0M14 9a2.5 2.5 0 1 0 0-5M18 17a4 4 0 0 0-4-4"),
  agents: icon("M7 4h6v4H7zM4 8h12v8H4zM8 12h.01M12 12h.01M10 2v2"),
};

type ProjectDetailNavProps = { projectId: string; groups: NavGroup[]; active: ProjectTab };

/** Sections of a project as a sidebar on wide screens; each one is a link, so it can be opened in a new tab. */
const ProjectDetailNav = ({ projectId, groups, active }: ProjectDetailNavProps) => {
  return (
    <nav aria-label="Secciones del proyecto" className="flex max-h-[calc(100dvh-11rem)] flex-col gap-5 overflow-y-auto pb-4">
      {groups.map((group, i) => (
        <div key={group.label ?? i} className="flex flex-col gap-0.5">
          {group.label && <h2 className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{group.label}</h2>}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const current = item.value === active;
              return (
                <li key={item.value}>
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId }}
                    search={(prev: Record<string, unknown>) => ({ ...prev, tab: item.value }) as never}
                    replace
                    aria-current={current ? "page" : undefined}
                    className={`relative flex min-h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors duration-150 ${current ? "bg-brand-soft font-medium text-brand" : "text-ink-soft hover:bg-subtle hover:text-ink"}`}
                  >
                    {current && <span aria-hidden className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-brand" />}
                    {item.icon}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.count !== undefined && <span className={`text-xs tabular-nums ${current ? "text-brand" : "text-muted"}`}>{item.count}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
};

export default ProjectDetailNav;
