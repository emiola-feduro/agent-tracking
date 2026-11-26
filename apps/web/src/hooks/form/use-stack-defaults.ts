import { useEffect } from "react";
import useStackRecommendation from "@/hooks/data/use-stack-recommendation";
import useWizardStore, { activePartOf, selectKind, selectPlatforms, selectStackTouched } from "@/stores/use-wizard-store";

/**
 * Applies the recommendation for the kind of project (in a monorepo, for the piece being edited)
 * until the person edits that stack by hand.
 */
const useStackDefaults = () => {
  const kind = useWizardStore(selectKind);
  const platforms = useWizardStore(selectPlatforms);
  const stackTouched = useWizardStore(selectStackTouched);
  const partId = useWizardStore((s) => activePartOf(s)?.id ?? null);
  const setStack = useWizardStore((s) => s.setStack);
  const recommendation = useStackRecommendation(kind, platforms);
  const { data } = recommendation;

  useEffect(() => {
    if (data && !stackTouched) setStack(data.stack, data.databases, false);
  }, [data, stackTouched, partId, setStack]);

  const apply = (stack: string[], databases: string[]) => setStack(stack, databases, true);

  return { recommendation, apply };
};

export default useStackDefaults;
