import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** Branch checked out in the project's local repo. A branch switch emits a project event, which refetches it. */
const useCurrentBranch = (id: string, enabled: boolean) =>
  useQuery({ queryKey: queryKeys.branch(id), queryFn: () => api.repoBranch(id), enabled, placeholderData: (previous) => previous });

export default useCurrentBranch;
