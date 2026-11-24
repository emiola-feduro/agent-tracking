import { useEffect } from "react";
import useStackRecommendation from "@/hooks/data/use-stack-recommendation";
import useWizardStore from "@/stores/use-wizard-store";

/** Applies the recommendation for the kind of project until the person edits the stack by hand. */
const useStackDefaults = () => {
  const kind = useWizardStore((s) => s.kind);
  const platforms = useWizardStore((s) => s.platforms);
  const stackTouched = useWizardStore((s) => s.stackTouched);
  const patch = useWizardStore((s) => s.patch);
  const recommendation = useStackRecommendation(kind, platforms);
  const { data } = recommendation;

  useEffect(() => {
    if (data && !stackTouched) patch({ stack: data.stack, databases: data.databases });
  }, [data, stackTouched, patch]);

  const apply = (stack: string[], databases: string[]) => patch({ stack, databases, stackTouched: true });

  return { recommendation, apply };
};

export default useStackDefaults;
