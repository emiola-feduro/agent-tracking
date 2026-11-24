import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";

/** Network failures and timeouts (status 0) and server errors are retried; a 4xx answer is final. */
const shouldRetry = (failures: number, error: unknown) =>
  failures < 4 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Live events invalidate queries, so data can stay fresh for a while without refetching.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: shouldRetry,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 5_000),
    },
  },
});
