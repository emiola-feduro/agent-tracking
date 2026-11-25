import useGithubBranches from "@/hooks/data/use-github-branches";
import GithubBranchRow from "./github-branch-row";
import GithubBranchesError from "./github-branches-error";
import GithubBranchesSkeleton from "./github-branches-skeleton";

const GithubBranches = ({ projectId }: { projectId: string }) => {
  const { data, status, error, refetch } = useGithubBranches(projectId);

  if (status === "pending") return <GithubBranchesSkeleton />;
  if (status === "error") return <GithubBranchesError error={error} onRetry={() => refetch()} />;
  return (
    <ul className="flex animate-enter flex-col divide-y divide-line rounded-lg border border-line bg-surface">
      {data.map((branch) => (
        <GithubBranchRow key={branch.name} projectId={projectId} branch={branch} />
      ))}
    </ul>
  );
};

export default GithubBranches;
