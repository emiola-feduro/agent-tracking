import { useState } from "react";
import StatusPill from "@/components/ui/status-pill/status-pill";
import type { PullSummary } from "@/lib/github-api";
import { PULL_STATE } from "@/lib/github-labels";
import { relativeTime } from "@/lib/relative-time";
import GithubPullDetail from "./github-pull-detail";

type GithubPullRowProps = {
  projectId: string;
  pull: PullSummary;
};

const GithubPullRow = ({ projectId, pull }: GithubPullRowProps) => {
  const { number, title, state, author, headRef, baseRef, updatedAt, url } = pull;
  const [isOpen, setIsOpen] = useState(false);
  const { label, tone } = PULL_STATE[state];

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
            <span className="text-sm tabular-nums text-muted">#{number}</span>
            <StatusPill tone={tone}>{label}</StatusPill>
          </span>
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
            <span>
              <code className="font-mono text-[13px] text-ink-soft">{headRef}</code> hacia{" "}
              <code className="font-mono text-[13px] text-ink-soft">{baseRef}</code>
            </span>
            {author && <span>{author.login}</span>}
            <span>actualizado {relativeTime(updatedAt)}</span>
          </span>
        </button>
        <a href={url} target="_blank" rel="noreferrer" className="shrink-0 text-sm text-brand underline-offset-2 hover:underline">
          Ver en GitHub
        </a>
      </div>
      {isOpen && <GithubPullDetail projectId={projectId} number={number} />}
    </li>
  );
};

export default GithubPullRow;
