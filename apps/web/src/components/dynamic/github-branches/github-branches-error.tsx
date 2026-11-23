import GithubError from "@/components/dynamic/github-panel/github-error";

type GithubBranchesErrorProps = {
  error: Error;
  onRetry: () => void;
};

const GithubBranchesError = ({ error, onRetry }: GithubBranchesErrorProps) => {
  return <GithubError error={error} what="las ramas" onRetry={onRetry} />;
};

export default GithubBranchesError;
