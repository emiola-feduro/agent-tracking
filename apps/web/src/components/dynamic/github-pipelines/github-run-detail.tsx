import useGithubRun from "@/hooks/data/use-github-run";
import GithubJob from "./github-job";
import GithubRunDetailError from "./github-run-detail-error";
import GithubRunDetailSkeleton from "./github-run-detail-skeleton";

type GithubRunDetailProps = {
  projectId: string;
  runId: number;
};

const GithubRunDetail = ({ projectId, runId }: GithubRunDetailProps) => {
  const { data, status, error, refetch } = useGithubRun(projectId, runId);

  return (
    <div className="border-t border-line bg-canvas/60 px-4 py-4">
      {status === "pending" && <GithubRunDetailSkeleton />}
      {status === "error" && <GithubRunDetailError error={error} onRetry={() => refetch()} />}
      {status === "success" && (
        <ul className="flex animate-enter flex-col gap-4">
          {data.jobs.length === 0 && <li className="text-sm text-muted">Esta ejecución no tiene jobs.</li>}
          {data.jobs.map((job) => (
            <GithubJob key={job.id} job={job} />
          ))}
        </ul>
      )}
    </div>
  );
};

export default GithubRunDetail;
