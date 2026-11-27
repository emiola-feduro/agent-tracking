import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type AgentKind, type ImplementItem, type LaunchBranch, type LaunchPermission } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** Agents started from the app on this project; refreshed every 2 s while one is running. */
const useAgentRuns = (projectId: string) => {
  const queryClient = useQueryClient();
  const key = queryKeys.runs(projectId);
  const runs = useQuery({
    queryKey: key,
    queryFn: () => api.runs(projectId),
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === "running" || r.status === "queued") ? 2000 : false),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const launch = useMutation({
    mutationFn: (data: { items: ImplementItem[]; agent: AgentKind; cwd?: string; branch?: LaunchBranch; permission: LaunchPermission; model?: string; instructions?: string }) =>
      api.launchRun(projectId, data),
    onSuccess: refresh,
  });
  const stop = useMutation({ mutationFn: (runId: string) => api.stopRun(projectId, runId), onSuccess: refresh });
  return { runs, launch, stop };
};

export default useAgentRuns;
