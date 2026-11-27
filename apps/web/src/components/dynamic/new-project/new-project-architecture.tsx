import ArchitecturePicker from "@/components/dynamic/architecture/architecture-picker";
import useWizardStore, { architectureChoices } from "@/stores/use-wizard-store";

/**
 * The architecture of each layer the project has: the recommended one is preselected with its reason,
 * the common alternatives are one click away, and "Ninguna en particular" leaves it to the agents.
 * The choice goes into CONTEXT.md, so every agent puts new code in the same places.
 */
const NewProjectArchitecture = () => {
  // Derived from the whole state (kinds, pieces and stack decide the recommendation).
  const state = useWizardStore();
  const choices = architectureChoices(state);
  if (!choices.length) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="architecture-title">
      <div>
        <h3 id="architecture-title" className="font-semibold text-ink">
          Arquitectura
        </h3>
        <p className="text-sm text-muted">Los agentes seguirán esta estructura al agregar código: queda escrita en el contexto del proyecto.</p>
      </div>
      <ArchitecturePicker choices={choices} onChoose={(layer, id) => state.patch({ architecture: { ...state.architecture, [layer]: id } })} />
    </section>
  );
};

export default NewProjectArchitecture;
