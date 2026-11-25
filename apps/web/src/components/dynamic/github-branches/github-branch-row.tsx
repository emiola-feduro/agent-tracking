import StatusPill from "@/components/ui/status-pill/status-pill";
import { useDeleteGithubBranch } from "@/hooks/data/use-github-branches";
import type { BranchSummary } from "@/lib/github-api";
import { PULL_STATE } from "@/lib/github-labels";
import { relativeTime } from "@/lib/relative-time";

/** Why a branch cannot be deleted on GitHub, or null when it can. */
const blockedReason = (b: BranchSummary & { agent?: boolean }) =>
  b.isDefault ? "Es la rama principal del repositorio" : b.protected ? "Está protegida en GitHub" : b.agent ? "Un agente está trabajando en esta rama" : null;

const GithubBranchRow = ({ projectId, branch }: { projectId: string; branch: BranchSummary & { agent?: boolean } }) => {
  const { name, isDefault, protected: isProtected, sha, commit, pull, url } = branch;
  const remove = useDeleteGithubBranch(projectId);
  const reason = blockedReason(branch);

  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <a href={url} target="_blank" rel="noreferrer" className="font-mono text-sm font-medium text-ink underline-offset-2 hover:underline">
            {name}
          </a>
          {isDefault && <StatusPill tone="brand">Principal</StatusPill>}
          {isProtected && <StatusPill>Protegida</StatusPill>}
          {branch.agent && <StatusPill tone="brand">Agente trabajando</StatusPill>}
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
      <span className="flex shrink-0 items-center gap-2">
        {remove.isError && <span className="text-xs text-danger">{(remove.error as Error).message}</span>}
        <button
          type="button"
          onClick={() => remove.mutate(name)}
          disabled={!!reason || remove.isPending}
          title={reason ?? `Borrar ${name} en GitHub`}
          aria-label={reason ? `No se puede borrar ${name}: ${reason}` : `Borrar la rama ${name} en GitHub`}
          className="grid size-8 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
        >
          {remove.isPending ? (
            <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
          ) : (
            <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5M7 7v4M9 7v4" />
            </svg>
          )}
        </button>
      </span>
    </li>
  );
};

export default GithubBranchRow;
