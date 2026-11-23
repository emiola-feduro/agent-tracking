import GithubError from "@/components/dynamic/github-panel/github-error";

type GithubPullsErrorProps = {
  error: Error;
  onRetry: () => void;
};

const GithubPullsError = ({ error, onRetry }: GithubPullsErrorProps) => {
  return <GithubError error={error} what="los pull requests" onRetry={onRetry} />;
};

export default GithubPullsError;
