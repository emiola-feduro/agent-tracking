import { useState } from "react";
import Segmented from "@/components/ui/segmented/segmented";
import useGithubPulls from "@/hooks/data/use-github-pulls";
import type { PullFilter } from "@/lib/github-api";
import { PULL_FILTERS } from "@/lib/github-labels";
import GithubPullRow from "./github-pull-row";
import GithubPullsError from "./github-pulls-error";
import GithubPullsSkeleton from "./github-pulls-skeleton";

const EMPTY: Record<PullFilter, string> = {
  open: "No hay pull requests abiertos.",
  merged: "No hay pull requests merged recientes.",
  closed: "No hay pull requests cerrados recientes.",
  all: "Este repositorio no tiene pull requests.",
};

const GithubPulls = ({ projectId }: { projectId: string }) => {
  const [state, setState] = useState<PullFilter>("open");
  const { data, status, error, refetch, isPlaceholderData } = useGithubPulls(projectId, state);

  return (
    <section className="flex flex-col gap-3">
      <Segmented label="Estado de los pull requests" items={PULL_FILTERS} value={state} onChange={setState} />
      {status === "pending" && <GithubPullsSkeleton />}
      {status === "error" && <GithubPullsError error={error} onRetry={() => refetch()} />}
      {status === "success" && data.length === 0 && (
        <p className="rounded-lg border border-line bg-surface p-5 text-muted">{EMPTY[state]}</p>
      )}
      {status === "success" && data.length > 0 && (
        <ul
          aria-busy={isPlaceholderData || undefined}
          className={`flex flex-col divide-y divide-line rounded-lg border border-line bg-surface transition-opacity duration-150 ${isPlaceholderData ? "opacity-60" : ""}`}
        >
          {data.map((pull) => (
            <GithubPullRow key={pull.number} projectId={projectId} pull={pull} />
          ))}
        </ul>
      )}
    </section>
  );
};

export default GithubPulls;
