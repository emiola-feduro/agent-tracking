import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** Providers the server can use and the active one; `choose` switches it for the running server. */
const useAssistantProviders = () => {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.assistantProviders, queryFn: api.assistantProviders });
  const mutation = useMutation({
    mutationFn: api.setAssistantProvider,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.assistantProviders, data);
      // The status (and so every token button) follows the new provider.
      queryClient.invalidateQueries({ queryKey: queryKeys.assistant, exact: true });
    },
  });
  return {
    providers: query.data?.providers ?? [],
    active: query.data?.active ?? null,
    isLoading: query.isPending,
    isError: query.isError,
    choose: mutation.mutate,
    isSwitching: mutation.isPending,
    switchError: mutation.error,
  };
};

export default useAssistantProviders;
