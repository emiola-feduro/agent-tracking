import { useQuery } from "@tanstack/react-query";
import { githubApi, githubKeys } from "@/lib/github-api";

const useGithubWorkflows = (projectId: string) =>
  useQuery({ queryKey: githubKeys.workflows(projectId), queryFn: () => githubApi.workflows(projectId) });

export default useGithubWorkflows;
