import StatusPill from "@/components/ui/status-pill/status-pill";
import useGithubPull from "@/hooks/data/use-github-pull";
import { RUN_STATUS } from "@/lib/github-labels";
import GithubPullChecks from "./github-pull-checks";
import GithubPullComments from "./github-pull-comments";
import GithubPullDetailError from "./github-pull-detail-error";
import GithubPullDetailSkeleton from "./github-pull-detail-skeleton";
import GithubPullFiles from "./github-pull-files";
import GithubPullReviews from "./github-pull-reviews";

type GithubPullDetailProps = {
  projectId: string;
  number: number;
};

const GithubPullDetail = ({ projectId, number }: GithubPullDetailProps) => {
  const { data, status, error, refetch } = useGithubPull(projectId, number);

  return (
    <div className="border-t border-line bg-canvas/60 px-4 py-4">
      {status === "pending" && <GithubPullDetailSkeleton />}
      {status === "error" && <GithubPullDetailError error={error} onRetry={() => refetch()} />}
      {status === "success" && (
        <div className="flex animate-enter flex-col gap-5">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
            <span className="tabular-nums">
              <span className="text-ok">+{data.additions}</span> <span className="text-danger">-{data.deletions}</span>
            </span>
            <span>{data.commits === 1 ? "1 commit" : `${data.commits} commits`}</span>
            {data.checksStatus && (
              <span className="flex items-center gap-2">
                Checks <StatusPill tone={RUN_STATUS[data.checksStatus].tone}>{RUN_STATUS[data.checksStatus].label}</StatusPill>
              </span>
            )}
          </p>
          <div className="grid gap-5 lg:grid-cols-2">
            <GithubPullChecks checks={data.checks} />
            <GithubPullReviews reviews={data.reviews} />
            <GithubPullFiles files={data.files} total={data.changedFiles} url={`${data.url}/files`} />
            <GithubPullComments comments={data.comments} />
          </div>
        </div>
      )}
    </div>
  );
};

export default GithubPullDetail;
