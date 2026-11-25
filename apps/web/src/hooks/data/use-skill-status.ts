import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** Which project skills this machine has, and how to install the rest. */
export const useSkillStatus = (projectId: string) =>
  useQuery({ queryKey: queryKeys.skillStatus(projectId), queryFn: () => api.skillStatus(projectId), placeholderData: (previous) => previous });

export const useSkillActions = (projectId: string) => {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
  return {
    install: useMutation({ mutationFn: (skillId: string) => api.installSkill(projectId, skillId), onSettled: refresh }),
    share: useMutation({ mutationFn: ({ skillId, shared }: { skillId: string; shared: boolean }) => api.shareSkill(projectId, skillId, shared), onSettled: refresh }),
  };
};
