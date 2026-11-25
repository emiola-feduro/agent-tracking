import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { githubApi, githubKeys } from "@/lib/github-api";

const useGithubBranches = (projectId: string) =>
  useQuery({ queryKey: githubKeys.branches(projectId), queryFn: () => githubApi.branches(projectId) });

/**
 * Deletes a branch on GitHub after the person confirms. When it still has commits missing from the
 * default branch or an open pull request, the server explains it and a second confirmation is needed.
 */
export const useDeleteGithubBranch = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (branch: string) => {
      if (!confirm(`Borrar la rama ${branch} en GitHub. Desde Agent Tracking no se puede deshacer.`)) return null;
      try {
        return await githubApi.deleteBranch(projectId, branch);
      } catch (e) {
        if (e instanceof ApiError && e.data.code === "confirm") {
          if (!confirm(`${e.message} ¿Borrarla igual en GitHub?`)) return null;
          return githubApi.deleteBranch(projectId, branch, true);
        }
        throw e;
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: githubKeys.branches(projectId) }),
  });
};

export default useGithubBranches;
