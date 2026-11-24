import { useQuery } from "@tanstack/react-query";
import { githubApi, githubKeys } from "@/lib/github-api";

const useGithubBranches = (projectId: string) =>
  useQuery({ queryKey: githubKeys.branches(projectId), queryFn: () => githubApi.branches(projectId) });

export default useGithubBranches;
