import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { githubApi, githubKeys, type RunFilter } from "@/lib/github-api";

const useGithubRuns = (projectId: string, filter: RunFilter) =>
  useQuery({
    queryKey: githubKeys.runs(projectId, filter),
    queryFn: () => githubApi.runs(projectId, filter),
    placeholderData: keepPreviousData,
  });

export default useGithubRuns;
