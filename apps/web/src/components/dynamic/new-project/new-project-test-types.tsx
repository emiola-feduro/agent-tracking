import { TEST_POLICY_TYPES } from "@agent-tracking/core";
import CheckOption from "@/components/ui/check-option/check-option";
import useWizardStore, { effectiveTestTypes } from "@/stores/use-wizard-store";

/** The kinds of tests agents must write; they go to CONTEXT.md and to each agent's instructions. */
const NewProjectTestTypes = () => {
  const chosen = useWizardStore((s) => effectiveTestTypes(s).join(","));
  const touched = useWizardStore((s) => s.testTypes !== null);
  const toggle = useWizardStore((s) => s.toggleTestType);
  const patch = useWizardStore((s) => s.patch);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">Tests que deben escribir los agentes</h3>
          <p className="text-sm text-muted">
            Se agregan a CONTEXT.md y a las instrucciones de cada agente. {touched ? "" : "Marcados los habituales para este tipo de proyecto."}
          </p>
        </div>
        {touched && (
          <button type="button" onClick={() => patch({ testTypes: null })} className="shrink-0 rounded-sm text-sm text-muted hover:text-ink">
            Volver a los sugeridos
          </button>
        )}
      </div>
      <div className="grid gap-x-6 sm:grid-cols-2">
        {TEST_POLICY_TYPES.map((t) => (
          <CheckOption
            key={t.type}
            checked={chosen.split(",").includes(t.type)}
            onChange={() => toggle(t.type)}
            label={t.label}
            meta={<span className="text-sm font-normal text-muted">{t.description}</span>}
          />
        ))}
      </div>
    </section>
  );
};

export default NewProjectTestTypes;
