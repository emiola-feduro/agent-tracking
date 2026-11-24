import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** Recent agent turns, newest first. A finished turn emits a project event, which refetches this. */
export const useAgentTurns = (projectId: string) =>
  useQuery({ queryKey: queryKeys.turns(projectId), queryFn: () => api.turns(projectId, 30), placeholderData: (previous) => previous });

/** One turn with its full diff, loaded when the diff is opened. */
export const useAgentTurn = (projectId: string, turnId: string | null) =>
  useQuery({
    queryKey: queryKeys.turn(projectId, turnId ?? ""),
    queryFn: () => api.turn(projectId, turnId!),
    enabled: !!turnId,
    staleTime: Infinity,
  });
