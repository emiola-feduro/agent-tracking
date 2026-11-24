import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ProjectView, type TestIdeaStatus } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** Mutations for a project's test ideas. Status changes and removals are optimistic. */
const useTestIdeaActions = (projectId: string) => {
  const queryClient = useQueryClient();
  const key = queryKeys.project(projectId);

  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const optimistic = <T>(update: (view: ProjectView, vars: T) => ProjectView) => ({
    onMutate: async (vars: T) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ProjectView>(key);
      if (previous) queryClient.setQueryData<ProjectView>(key, update(previous, vars));
      return { previous };
    },
    onError: (_error: unknown, _vars: T, context?: { previous?: ProjectView }) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: refresh,
  });

  const addIdea = useMutation({
    mutationFn: (data: { text: string; requirementId: string | null }) => api.addTestIdea(projectId, data),
    onSettled: refresh,
  });

  const setStatus = useMutation({
    mutationFn: ({ ideaId, status }: { ideaId: string; status: TestIdeaStatus }) => api.setTestIdeaStatus(projectId, ideaId, status),
    ...optimistic<{ ideaId: string; status: TestIdeaStatus }>((view, { ideaId, status }) => ({
      ...view,
      testIdeas: view.testIdeas.map((t) => (t.id === ideaId ? { ...t, status } : t)),
    })),
  });

  const removeIdea = useMutation({
    mutationFn: (ideaId: string) => api.deleteTestIdea(projectId, ideaId),
    ...optimistic<string>((view, ideaId) => ({ ...view, testIdeas: view.testIdeas.filter((t) => t.id !== ideaId) })),
  });

  return { addIdea, setStatus, removeIdea };
};

export default useTestIdeaActions;
