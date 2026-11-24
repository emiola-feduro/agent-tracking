import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { githubApi, githubKeys } from "@/lib/github-api";

/** Auth kind and remaining rate limit; refreshes in the background. */
const useGithubStatus = () => {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: githubKeys.status, queryFn: githubApi.status, refetchInterval: 60_000 });
  const refresh = useMutation({
    mutationFn: githubApi.refreshAuth,
    onSuccess: (data) => {
      queryClient.setQueryData(githubKeys.status, data);
      // New credentials may unlock private repositories: refetch every GitHub query.
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey.includes("github") });
    },
  });
  return { status, refresh };
};

export default useGithubStatus;
