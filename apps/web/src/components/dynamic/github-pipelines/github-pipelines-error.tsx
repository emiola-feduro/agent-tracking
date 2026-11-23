import GithubError from "@/components/dynamic/github-panel/github-error";

type GithubPipelinesErrorProps = {
  error: Error;
  onRetry: () => void;
};

const GithubPipelinesError = ({ error, onRetry }: GithubPipelinesErrorProps) => {
  return <GithubError error={error} what="los pipelines" onRetry={onRetry} />;
};

export default GithubPipelinesError;
