import GithubError from "@/components/dynamic/github-panel/github-error";

type GithubRunDetailErrorProps = {
  error: Error;
  onRetry: () => void;
};

const GithubRunDetailError = ({ error, onRetry }: GithubRunDetailErrorProps) => {
  return <GithubError error={error} what="los jobs de la ejecución" onRetry={onRetry} />;
};

export default GithubRunDetailError;
