import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** Deletes a project, leaves its page and only then drops its cache (so nothing refetches a 404). */
const useDeleteProject = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: api.deleteProject,
    onSuccess: async (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects, exact: true });
      await navigate({ to: "/" });
      queryClient.removeQueries({ queryKey: queryKeys.project(id) });
    },
  });
};

export default useDeleteProject;
