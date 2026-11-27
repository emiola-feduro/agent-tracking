import { ARCHITECTURES, architectureOf, type ArchitectureLayer } from "@agent-tracking/core";
import ChoiceCard from "@/components/ui/choice-card/choice-card";
import useWizardStore, { architectureChoices } from "@/stores/use-wizard-store";

const LAYER_LABEL: Record<ArchitectureLayer, { title: string; hint: string }> = {
  frontend: { title: "Frontend", hint: "Cómo se organiza la interfaz (web, móvil o escritorio)." },
  backend: { title: "Backend", hint: "Cómo se organiza el servidor y su lógica de negocio." },
};

/**
 * The architecture of each layer the project has: the recommended one is preselected with its reason,
 * the common alternatives are one click away, and "Ninguna en particular" leaves it to the agents.
 * The choice goes into CONTEXT.md, so every agent puts new code in the same places.
 */
const NewProjectArchitecture = () => {
  // Derived from the whole state (kinds, pieces and stack decide the recommendation).
  const state = useWizardStore();
  const choices = architectureChoices(state);
  const set = state.patch;
  const current = state.architecture;
  if (!choices.length) return null;
  const choose = (layer: ArchitectureLayer, id: string | null) => set({ architecture: { ...current, [layer]: id } });

  return (
    <section className="flex flex-col gap-5" aria-labelledby="architecture-title">
      <div>
        <h3 id="architecture-title" className="font-semibold text-ink">
          Arquitectura
        </h3>
        <p className="text-sm text-muted">Los agentes seguirán esta estructura al agregar código: queda escrita en el contexto del proyecto.</p>
      </div>
      {choices.map(({ layer, recommended, chosen }) => {
        const touched = layer in current;
        const rec = architectureOf(layer, recommended.id);
        return (
          <fieldset key={layer} className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink">{LAYER_LABEL[layer].title}</legend>
            <p className="text-sm text-muted">{LAYER_LABEL[layer].hint}</p>
            {rec && (
              <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
                <span>
                  Recomendada: <strong className="font-medium text-ink">{rec.label}</strong>. {recommended.reason}
                </span>
                {touched && chosen !== recommended.id && (
                  <button type="button" onClick={() => choose(layer, recommended.id)} className="rounded-sm font-medium text-brand hover:underline">
                    Usar la recomendada
                  </button>
                )}
              </p>
            )}
            <div role="radiogroup" aria-label={`Arquitectura de ${LAYER_LABEL[layer].title.toLowerCase()}`} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ARCHITECTURES[layer].map((a) => (
                <ChoiceCard
                  key={a.id}
                  mode="radio"
                  title={a.id === recommended.id ? `${a.label} (recomendada)` : a.label}
                  description={`${a.description} ${a.when}`}
                  selected={chosen === a.id}
                  onSelect={() => choose(layer, a.id)}
                />
              ))}
              <ChoiceCard
                mode="radio"
                title="Ninguna en particular"
                description="Cada agente organiza el código como le parezca mejor."
                selected={chosen === null}
                onSelect={() => choose(layer, null)}
              />
            </div>
          </fieldset>
        );
      })}
    </section>
  );
};

export default NewProjectArchitecture;
