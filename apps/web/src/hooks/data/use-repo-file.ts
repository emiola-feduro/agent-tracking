import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** A file of the project's repository for previews; refetched when the repository changes. */
const useRepoFile = (projectId: string, path: string, enabled: boolean, worktree?: string) =>
  useQuery({
    queryKey: queryKeys.file(projectId, path, worktree),
    queryFn: () => api.repoFile(projectId, path, worktree),
    enabled,
    staleTime: 10_000,
    retry: (failures, error) => failures < 2 && (error as { status?: number }).status !== 404,
  });

export default useRepoFile;
