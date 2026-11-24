import StatusPill from "@/components/ui/status-pill/status-pill";
import type { PullDetail } from "@/lib/github-api";
import { RUN_STATUS } from "@/lib/github-labels";

const GithubPullChecks = ({ checks }: { checks: PullDetail["checks"] }) => {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold text-ink">Checks</h4>
      {checks.length === 0 && <p className="text-sm text-muted">Sin checks para el último commit.</p>}
      <ul className="flex flex-col gap-1.5">
        {checks.map(({ id, name, status, url }) => (
          <li key={id} className="flex items-center justify-between gap-3 text-sm">
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-ink underline-offset-2 hover:underline">
                {name}
              </a>
            ) : (
              <span className="min-w-0 truncate">{name}</span>
            )}
            <StatusPill tone={RUN_STATUS[status].tone}>{RUN_STATUS[status].label}</StatusPill>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default GithubPullChecks;
