import { useQuery } from "@tanstack/react-query";
import { githubApi, githubKeys } from "@/lib/github-api";

const useGithubRun = (projectId: string, runId: number) =>
  useQuery({ queryKey: githubKeys.run(projectId, runId), queryFn: () => githubApi.run(projectId, runId) });

export default useGithubRun;
