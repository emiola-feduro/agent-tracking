import GithubError from "@/components/dynamic/github-panel/github-error";

type GithubPullDetailErrorProps = {
  error: Error;
  onRetry: () => void;
};

const GithubPullDetailError = ({ error, onRetry }: GithubPullDetailErrorProps) => {
  return <GithubError error={error} what="los detalles del pull request" onRetry={onRetry} />;
};

export default GithubPullDetailError;
