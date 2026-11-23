import { useQuery } from "@tanstack/react-query";
import { api, type Platform } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

const useStackRecommendation = (platforms: Platform[]) =>
  useQuery({
    queryKey: queryKeys.recommendation(platforms),
    queryFn: () => api.recommendStack(platforms),
    enabled: platforms.length > 0,
    staleTime: Infinity,
  });

export default useStackRecommendation;
