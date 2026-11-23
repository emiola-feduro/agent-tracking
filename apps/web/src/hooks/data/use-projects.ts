import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export const projectsQuery = { queryKey: queryKeys.projects, queryFn: api.listProjects };

const useProjects = () => useQuery(projectsQuery);

export default useProjects;
