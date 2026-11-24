import { kindPlatforms, PROJECT_KIND_INFO } from "@agent-tracking/core";
import { useQuery } from "@tanstack/react-query";
import { api, type Platform, type ProjectKind } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

const useStackRecommendation = (kind: ProjectKind, chosen: Platform[]) => {
  const platforms = kindPlatforms(kind, chosen);
  return useQuery({
    queryKey: queryKeys.recommendation(kind, platforms),
    queryFn: () => api.recommendStack(kind, platforms),
    // A full app needs its platforms first; other kinds have them fixed (or none at all).
    enabled: PROJECT_KIND_INFO[kind].platforms !== null || platforms.length > 0,
    staleTime: Infinity,
  });
};

export default useStackRecommendation;
