import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

const useCatalogSkills = (enabled: boolean) =>
  useQuery({ queryKey: queryKeys.catalogSkills, queryFn: api.catalogSkills, enabled, staleTime: Infinity });

export default useCatalogSkills;
