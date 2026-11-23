import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { githubApi, githubKeys, type PullFilter } from "@/lib/github-api";

const useGithubPulls = (projectId: string, state: PullFilter) =>
  useQuery({
    queryKey: githubKeys.pulls(projectId, state),
    queryFn: () => githubApi.pulls(projectId, state),
    placeholderData: keepPreviousData,
  });

export default useGithubPulls;
