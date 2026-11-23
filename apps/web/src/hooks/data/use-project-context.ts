import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

const useProjectContext = (id: string) =>
  useQuery({ queryKey: queryKeys.context(id), queryFn: () => api.contextMarkdown(id), staleTime: 0 });

export default useProjectContext;
