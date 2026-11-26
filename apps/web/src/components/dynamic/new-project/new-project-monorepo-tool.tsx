import { monorepoToolsFor, recommendMonorepoTool } from "@agent-tracking/core";
import ChoiceCard from "@/components/ui/choice-card/choice-card";
import useWizardStore from "@/stores/use-wizard-store";

/** How the pieces are tied together; only the tools that fit their languages are offered. */
const NewProjectMonorepoTool = () => {
  const parts = useWizardStore((s) => s.parts);
  const chosen = useWizardStore((s) => s.monorepoTool);
  const patch = useWizardStore((s) => s.patch);
  const tools = monorepoToolsFor(parts);
  const recommended = recommendMonorepoTool(parts);
  // A tool that no longer fits the languages falls back to the recommendation.
  const value = chosen && tools.some((t) => t.id === chosen) ? chosen : recommended;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="font-semibold text-ink">Herramienta del monorepo</h3>
        <p className="text-sm text-muted">Cómo se instalan y construyen las piezas juntas. Se ofrecen las que sirven para los lenguajes elegidos.</p>
      </div>
      <div role="radiogroup" aria-label="Herramienta del monorepo" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <ChoiceCard
            key={t.id}
            mode="radio"
            title={t.id === recommended ? `${t.label} (recomendada)` : t.label}
            description={t.description}
            selected={value === t.id}
            onSelect={() => patch({ monorepoTool: t.id })}
          />
        ))}
      </div>
    </section>
  );
};

export default NewProjectMonorepoTool;
