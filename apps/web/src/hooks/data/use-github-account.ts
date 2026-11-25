import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** The GitHub account (and organizations) that can own new repositories, through gh on the server. */
const useGithubAccount = (enabled = true) =>
  useQuery({ queryKey: queryKeys.githubAccount, queryFn: api.githubAccount, enabled, staleTime: 5 * 60_000 });

export default useGithubAccount;
