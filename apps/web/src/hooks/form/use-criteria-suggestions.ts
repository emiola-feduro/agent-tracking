import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

type UseCriteriaSuggestionsOptions = {
  /** Asks the assistant; resolves with the suggested criteria. */
  fetch: () => Promise<{ criteria: string[] }>;
  /** Applies accepted criteria (to the draft or to the stored requirement). */
  accept: (criteria: string[]) => unknown;
};

/** Pending Definition of Done suggestions the person accepts or discards one by one. */
const useCriteriaSuggestions = ({ fetch, accept }: UseCriteriaSuggestionsOptions) => {
  const [pending, setPending] = useState<string[]>([]);
  const request = useMutation({ mutationFn: fetch, onSuccess: ({ criteria }) => setPending(criteria) });

  const remove = (items: string[]) => setPending((list) => list.filter((c) => !items.includes(c)));

  return {
    pending,
    suggest: () => request.mutate(),
    isLoading: request.isPending,
    error: request.error,
    acceptOne: (criterion: string) => {
      accept([criterion]);
      remove([criterion]);
    },
    dismissOne: (criterion: string) => remove([criterion]),
    acceptAll: () => {
      accept(pending);
      setPending([]);
    },
    dismissAll: () => setPending([]),
  };
};

export default useCriteriaSuggestions;
