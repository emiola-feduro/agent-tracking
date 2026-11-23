import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type DodStatus, type ProjectView } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/**
 * Mutations for one project. Toggles are optimistic so the UI responds instantly; every mutation
 * refetches the project afterwards (live events also do, for other clients).
 */
const useProjectActions = (projectId: string) => {
  const queryClient = useQueryClient();
  const key = queryKeys.project(projectId);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: queryKeys.projects, exact: true });
  };

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

  const setDodStatus = useMutation({
    mutationFn: ({ reqId, dodId, status }: { reqId: string; dodId: string; status: DodStatus }) =>
      api.setDodStatus(projectId, reqId, dodId, status),
    ...optimistic<{ reqId: string; dodId: string; status: DodStatus }>((view, { dodId, status }) => ({
      ...view,
      dod: view.dod.map((d) => (d.id === dodId ? { ...d, status } : d)),
    })),
  });

  const toggleSkill = useMutation({
    mutationFn: ({ skillId, enabled }: { skillId: string; enabled: boolean }) => api.toggleSkill(projectId, skillId, enabled),
    ...optimistic<{ skillId: string; enabled: boolean }>((view, { skillId, enabled }) => ({
      ...view,
      skills: view.skills.map((k) => (k.id === skillId ? { ...k, enabled } : k)),
    })),
  });

  const removeSkill = useMutation({
    mutationFn: (skillId: string) => api.removeSkill(projectId, skillId),
    ...optimistic<string>((view, skillId) => ({ ...view, skills: view.skills.filter((k) => k.id !== skillId) })),
  });

  const deleteRule = useMutation({
    mutationFn: (ruleId: string) => api.deleteRule(projectId, ruleId),
    ...optimistic<string>((view, ruleId) => ({ ...view, rules: view.rules.filter((r) => r.id !== ruleId) })),
  });

  const deleteDod = useMutation({
    mutationFn: ({ reqId, dodId }: { reqId: string; dodId: string }) => api.deleteDod(projectId, reqId, dodId),
    ...optimistic<{ reqId: string; dodId: string }>((view, { dodId }) => ({
      ...view,
      dod: view.dod.filter((d) => d.id !== dodId),
    })),
  });

  const deleteRequirement = useMutation({
    mutationFn: (reqId: string) => api.deleteRequirement(projectId, reqId),
    ...optimistic<string>((view, reqId) => ({
      ...view,
      requirements: view.requirements.filter((r) => r.id !== reqId),
    })),
  });

  const addRule = useMutation({
    mutationFn: (text: string) => {
      const rules = queryClient.getQueryData<ProjectView>(key)?.rules ?? [];
      return api.addRule(projectId, text, rules.length + 1);
    },
    onSettled: refresh,
  });

  const addDod = useMutation({
    mutationFn: ({ reqId, criterion }: { reqId: string; criterion: string }) => api.addDod(projectId, reqId, criterion),
    onSettled: refresh,
  });

  const addRequirement = useMutation({
    mutationFn: ({ title, description }: { title: string; description: string }) =>
      api.addRequirement(projectId, title, description),
    onSettled: refresh,
  });

  const sync = useMutation({ mutationFn: () => api.syncProject(projectId), onSettled: refresh });
  const writeRepoFiles = useMutation({ mutationFn: () => api.writeRepoFiles(projectId) });

  return {
    setDodStatus,
    toggleSkill,
    removeSkill,
    deleteRule,
    deleteDod,
    deleteRequirement,
    addRule,
    addDod,
    addRequirement,
    sync,
    writeRepoFiles,
  };
};

export default useProjectActions;
