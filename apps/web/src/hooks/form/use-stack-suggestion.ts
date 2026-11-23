import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api, type StackRecommendation } from "@/lib/api";
import useWizardStore, { wizardBrief } from "@/stores/use-wizard-store";

export type StackChoice = { stack: string[]; databases: string[]; when: string; recommended: boolean };

const toChoices = ({ stack, databases, rationale, alternatives }: StackRecommendation): StackChoice[] => [
  { stack, databases, when: rationale, recommended: true },
  ...alternatives.map((a) => ({ ...a, recommended: false })),
];

/** "Sugerir con IA" on the stack step: each proposal can be applied or discarded. */
const useStackSuggestion = (apply: (stack: string[], databases: string[]) => void) => {
  const [choices, setChoices] = useState<StackChoice[]>([]);
  const request = useMutation({
    mutationFn: () => api.suggestStack(wizardBrief(useWizardStore.getState())),
    onSuccess: ({ source, recommendation }) => setChoices(source === "assistant" ? toChoices(recommendation) : []),
  });
  const { data, isPending, error } = request;

  return {
    choices,
    suggest: () => request.mutate(),
    isLoading: isPending,
    error,
    /** The assistant answered something unusable and the server fell back to the base proposal. */
    fellBack: data?.source === "default",
    accept: (choice: StackChoice) => {
      apply(choice.stack, choice.databases);
      setChoices([]);
    },
    dismiss: (choice: StackChoice) => setChoices((list) => list.filter((c) => c !== choice)),
  };
};

export default useStackSuggestion;
