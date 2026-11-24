import StatusPill from "@/components/ui/status-pill/status-pill";
import type { BranchSummary } from "@/lib/github-api";
import { PULL_STATE } from "@/lib/github-labels";
import { relativeTime } from "@/lib/relative-time";

const GithubBranchRow = ({ branch }: { branch: BranchSummary }) => {
  const { name, isDefault, protected: isProtected, sha, commit, pull, url } = branch;

  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <a href={url} target="_blank" rel="noreferrer" className="font-mono text-sm font-medium text-ink underline-offset-2 hover:underline">
            {name}
          </a>
          {isDefault && <StatusPill tone="brand">Principal</StatusPill>}
          {isProtected && <StatusPill>Protegida</StatusPill>}
        </span>
        <span className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
          {commit ? (
            <>
              <a href={commit.url} target="_blank" rel="noreferrer" className="min-w-0 max-w-full truncate text-ink-soft underline-offset-2 hover:underline">
                {commit.message}
              </a>
              {commit.author && <span>{commit.author}</span>}
              {commit.date && <span>{relativeTime(commit.date)}</span>}
            </>
          ) : (
            <code className="font-mono text-[0.8125rem]">{sha.slice(0, 7)}</code>
          )}
        </span>
      </div>
      {pull ? (
        <a href={pull.url} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-2 text-sm text-ink underline-offset-2 hover:underline">
          PR #{pull.number}
          <StatusPill tone={PULL_STATE[pull.state].tone}>{PULL_STATE[pull.state].label}</StatusPill>
        </a>
      ) : (
        !isDefault && <span className="shrink-0 text-sm text-muted">Sin PR</span>
      )}
    </li>
  );
};

export default GithubBranchRow;
