import { useQuery } from "@tanstack/react-query";
import { githubApi, githubKeys } from "@/lib/github-api";

const useGithubPull = (projectId: string, number: number) =>
  useQuery({ queryKey: githubKeys.pull(projectId, number), queryFn: () => githubApi.pull(projectId, number) });

export default useGithubPull;
