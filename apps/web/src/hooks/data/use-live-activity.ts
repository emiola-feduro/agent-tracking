import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** The agent's current steps. Hook events over the WebSocket invalidate it (see use-live-events.ts). */
const useLiveActivity = (id: string) =>
  useQuery({ queryKey: queryKeys.live(id), queryFn: () => api.live(id), placeholderData: (previous) => previous });

export default useLiveActivity;
