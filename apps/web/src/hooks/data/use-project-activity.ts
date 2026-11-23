import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** Latest agent events, newest first. Live events invalidate the project prefix, which refetches this. */
const useProjectActivity = (id: string) =>
  useQuery({ queryKey: queryKeys.activity(id), queryFn: () => api.activity(id), placeholderData: (previous) => previous });

export default useProjectActivity;
