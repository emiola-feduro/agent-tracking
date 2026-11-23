import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

const useInstalledSkills = (repoPath: string | null) =>
  useQuery({ queryKey: queryKeys.installedSkills(repoPath), queryFn: () => api.discoverSkills(repoPath) });

export default useInstalledSkills;
