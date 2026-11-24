import { useState } from "react";
import StatusPill from "@/components/ui/status-pill/status-pill";
import type { WorkflowRun } from "@/lib/github-api";
import { RUN_STATUS } from "@/lib/github-labels";
import { relativeTime } from "@/lib/relative-time";
import GithubRunDetail from "./github-run-detail";

type GithubRunRowProps = {
  projectId: string;
  run: WorkflowRun;
};

const GithubRunRow = ({ projectId, run }: GithubRunRowProps) => {
  const { id, name, title, branch, event, status, runNumber, actor, createdAt, url } = run;
  const [isOpen, setIsOpen] = useState(false);
  const { label, tone } = RUN_STATUS[status];

  return (
    <li className="animate-enter">
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((v) => !v)}
          className="flex min-w-0 flex-1 flex-col gap-1 rounded-md text-left"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{title}</span>
            <StatusPill tone={tone}>{label}</StatusPill>
          </span>
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
            <span>
              {name} #{runNumber}
            </span>
            {branch && <code className="font-mono text-[13px] text-ink-soft">{branch}</code>}
            <span>{event}</span>
            {actor && <span>{actor.login}</span>}
            <span>{relativeTime(createdAt)}</span>
          </span>
        </button>
        <a href={url} target="_blank" rel="noreferrer" className="shrink-0 text-sm text-brand underline-offset-2 hover:underline">
          Ver en GitHub
        </a>
      </div>
      {isOpen && <GithubRunDetail projectId={projectId} runId={id} />}
    </li>
  );
};

export default GithubRunRow;
