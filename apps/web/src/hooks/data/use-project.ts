import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export const projectQuery = (id: string) => ({ queryKey: queryKeys.project(id), queryFn: () => api.getProject(id) });

const useProject = (id: string) => useQuery(projectQuery(id));

export default useProject;
