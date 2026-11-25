import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type DodStatus, type ProjectView, type RequirementArea, type RequirementType } from "@/lib/api";
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

  /** Accepted assistant suggestions, stored with origin "llm". */
  const addLlmDod = useMutation({
    mutationFn: async ({ reqId, criteria }: { reqId: string; criteria: string[] }) => {
      for (const criterion of criteria) await api.addDod(projectId, reqId, criterion, "llm");
    },
    onSettled: refresh,
  });

  const addRequirement = useMutation({
    mutationFn: (data: { title: string; description: string; type?: RequirementType; area?: RequirementArea }) =>
      api.addRequirement(projectId, data),
    onSettled: refresh,
  });

  /** Type and area change instantly; the server confirms afterwards. */
  const updateRequirement = useMutation({
    mutationFn: ({ reqId, ...data }: { reqId: string; type?: RequirementType; area?: RequirementArea; title?: string; description?: string }) =>
      api.updateRequirement(projectId, reqId, data),
    ...optimistic<{ reqId: string; type?: RequirementType; area?: RequirementArea; title?: string; description?: string }>((view, { reqId, ...data }) => ({
      ...view,
      requirements: view.requirements.map((r) => (r.id === reqId ? { ...r, ...data } : r)),
    })),
  });

  const importRequirements = useMutation({ mutationFn: (text: string) => api.importRequirements(projectId, text), onSettled: refresh });

  const uploadImages = useMutation({
    mutationFn: async ({ files, ...meta }: { files: File[]; kind?: "reference" | "screen"; requirementId?: string; dodItemId?: string; title?: string; route?: string }) => {
      for (const file of files) await api.uploadAttachment(projectId, file, meta);
    },
    onSettled: refresh,
  });
  const updateImage = useMutation({
    mutationFn: ({ attachmentId, ...data }: { attachmentId: string; title?: string; route?: string; featureId?: string | null }) =>
      api.updateAttachment(projectId, attachmentId, data),
    onSettled: refresh,
  });
  const deleteImage = useMutation({
    mutationFn: (attachmentId: string) => api.deleteAttachment(projectId, attachmentId),
    ...optimistic<string>((view, attachmentId) => ({ ...view, attachments: view.attachments.filter((a) => a.id !== attachmentId) })),
  });

  const sync = useMutation({ mutationFn: () => api.syncProject(projectId), onSettled: refresh });
  const writeRepoFiles = useMutation({ mutationFn: () => api.writeRepoFiles(projectId) });

  return {
    importRequirements,
    updateRequirement,
    uploadImages,
    updateImage,
    deleteImage,
    setDodStatus,
    toggleSkill,
    removeSkill,
    deleteRule,
    deleteDod,
    deleteRequirement,
    addRule,
    addDod,
    addLlmDod,
    addRequirement,
    sync,
    writeRepoFiles,
  };
};

export default useProjectActions;
