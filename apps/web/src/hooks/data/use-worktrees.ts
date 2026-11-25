import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** Checkouts of the repository with how far each one moved from the base branch. */
export const useWorktrees = (projectId: string, enabled = true) =>
  useQuery({ queryKey: queryKeys.worktrees(projectId), queryFn: () => api.worktrees(projectId), enabled, placeholderData: (previous) => previous });

export const useLocalBranches = (projectId: string) =>
  useQuery({ queryKey: queryKeys.branches(projectId), queryFn: () => api.localBranches(projectId), placeholderData: (previous) => previous });

export const useWorktreeDiff = (projectId: string, worktree: string | null) =>
  useQuery({
    queryKey: queryKeys.worktreeDiff(projectId, worktree ?? ""),
    queryFn: () => api.worktreeDiff(projectId, worktree!),
    enabled: !!worktree,
  });

/** Deletes a local branch; `force` also deletes commits no other branch has. */
export const useDeleteBranch = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ branch, force }: { branch: string; force: boolean }) => api.deleteBranch(projectId, branch, force),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) }),
  });
};

/** Switches the main checkout to another local branch; everything about the project is refetched. */
export const useCheckout = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branch: string) => api.checkout(projectId, branch),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) }),
  });
};
