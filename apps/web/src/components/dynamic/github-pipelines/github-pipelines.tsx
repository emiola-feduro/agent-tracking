import { useState } from "react";
import useGithubRuns from "@/hooks/data/use-github-runs";
import GithubPipelinesError from "./github-pipelines-error";
import GithubPipelinesFilters from "./github-pipelines-filters";
import GithubPipelinesSkeleton from "./github-pipelines-skeleton";
import GithubRunRow from "./github-run-row";

const GithubPipelines = ({ projectId }: { projectId: string }) => {
  const [branch, setBranch] = useState("");
  const [workflowId, setWorkflowId] = useState(0);
  const { data, status, error, refetch, isPlaceholderData } = useGithubRuns(projectId, {
    branch: branch || undefined,
    workflowId: workflowId || undefined,
  });

  return (
    <section className="flex flex-col gap-3">
      <GithubPipelinesFilters
        projectId={projectId}
        branch={branch}
        onBranchChange={setBranch}
        workflowId={workflowId}
        onWorkflowChange={setWorkflowId}
      />
      {status === "pending" && <GithubPipelinesSkeleton />}
      {status === "error" && <GithubPipelinesError error={error} onRetry={() => refetch()} />}
      {status === "success" && data.length === 0 && (
        <p className="rounded-lg border border-line bg-surface p-5 text-muted">
          {branch || workflowId ? "No hay ejecuciones con estos filtros." : "Este repositorio no tiene ejecuciones de GitHub Actions."}
        </p>
      )}
      {status === "success" && data.length > 0 && (
        <ul
          aria-busy={isPlaceholderData || undefined}
          className={`flex flex-col divide-y divide-line rounded-lg border border-line bg-surface transition-opacity duration-150 ${isPlaceholderData ? "opacity-60" : ""}`}
        >
          {data.map((run) => (
            <GithubRunRow key={run.id} projectId={projectId} run={run} />
          ))}
        </ul>
      )}
    </section>
  );
};

export default GithubPipelines;
