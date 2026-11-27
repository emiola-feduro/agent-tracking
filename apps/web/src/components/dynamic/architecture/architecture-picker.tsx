import { ARCHITECTURES, architectureOf, type ArchitectureLayer } from "@agent-tracking/core";
import ChoiceCard from "@/components/ui/choice-card/choice-card";

const LAYER_LABEL: Record<ArchitectureLayer, { title: string; hint: string }> = {
  frontend: { title: "Frontend", hint: "Cómo se organiza la interfaz (web, móvil o escritorio)." },
  backend: { title: "Backend", hint: "Cómo se organiza el servidor y su lógica de negocio." },
};

export type ArchitectureChoice = { layer: ArchitectureLayer; recommended: { id: string; reason: string }; chosen: string | null };

type Props = {
  choices: ArchitectureChoice[];
  onChoose: (layer: ArchitectureLayer, id: string | null) => void;
  disabled?: boolean;
};

/**
 * One group per layer: the recommended architecture with its reason, the common alternatives and
 * "Ninguna en particular". Used by the wizard and by the project page.
 */
const ArchitecturePicker = ({ choices, onChoose, disabled = false }: Props) => (
  <div className="flex flex-col gap-5">
    {choices.map(({ layer, recommended, chosen }) => {
      const rec = architectureOf(layer, recommended.id);
      return (
        <fieldset key={layer} className="flex flex-col gap-2" disabled={disabled}>
          <legend className="mb-1 text-sm font-medium text-ink">{LAYER_LABEL[layer].title}</legend>
          <p className="text-sm text-muted">{LAYER_LABEL[layer].hint}</p>
          {rec && (
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
              <span>
                Recomendada: <strong className="font-medium text-ink">{rec.label}</strong>. {recommended.reason}
              </span>
              {chosen !== recommended.id && (
                <button type="button" onClick={() => onChoose(layer, recommended.id)} className="rounded-sm font-medium text-brand hover:underline">
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
                onSelect={() => onChoose(layer, a.id)}
              />
            ))}
            <ChoiceCard
              mode="radio"
              title="Ninguna en particular"
              description="Cada agente organiza el código como le parezca mejor."
              selected={chosen === null}
              onSelect={() => onChoose(layer, null)}
            />
          </div>
        </fieldset>
      );
    })}
  </div>
);

export default ArchitecturePicker;
