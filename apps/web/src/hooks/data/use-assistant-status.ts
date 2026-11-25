import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/**
 * Whether the server can reach an assistant provider (Claude, OpenAI, Gemini, by API key or a local CLI login). `configured` stays false while loading or on error,
 * so assistant actions only appear once the server confirms them.
 */
const useAssistantStatus = () => {
  const query = useQuery({ queryKey: queryKeys.assistant, queryFn: api.assistantStatus, staleTime: Infinity, retry: 1 });
  return {
    configured: query.data?.configured === true,
    provider: query.data?.provider ?? null,
    /** Whose tokens a request spends, e.g. "Claude" or "OpenAI". */
    vendor: query.data?.vendor ?? null,
    /** Known to be off (answered false or unreachable); show the setup note. */
    disabled: query.data?.configured === false || query.isError,
    settled: !query.isPending,
  };
};

export default useAssistantStatus;
