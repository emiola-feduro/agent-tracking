import { STACK_LANGUAGES, STACK_OPTIONS } from "@agent-tracking/core";
import { useShallow } from "zustand/react/shallow";
import useStackSections from "@/hooks/form/use-stack-sections";
import useWizardStore, { activePartOf, selectStack } from "@/stores/use-wizard-store";
import NewProjectTechSearch from "./new-project-tech-search";
import NewProjectStackSection from "./new-project-stack-section";

const known = new Set(STACK_OPTIONS.map((o) => o.name));

const Step = ({ n, title, hint }: { n: number; title: string; hint: string }) => (
  <div className="flex items-start gap-3">
    <span aria-hidden className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand">
      {n}
    </span>
    <div>
      <h4 className="font-semibold text-ink">{title}</h4>
      <p className="text-sm text-muted">{hint}</p>
    </div>
  </div>
);

/**
 * Technologies, in the order a person decides them: the languages first, then the frameworks,
 * libraries and tests that work with those languages on the chosen platforms.
 */
const NewProjectStackGroups = () => {
  const stack = useWizardStore(selectStack);
  const { languages, chosenLanguages, sections } = useStackSections();
  const toggleIn = useWizardStore((s) => s.toggleIn);
  // In a monorepo, the languages the other pieces use are one click away (shared code, one toolchain).
  const shared = useWizardStore(
    useShallow((s) => {
      const part = activePartOf(s);
      if (!part) return [];
      const used = new Set(s.parts.filter((p) => p.id !== part.id).flatMap((p) => p.stack));
      return STACK_LANGUAGES.filter((l) => used.has(l) && !part.stack.includes(l));
    }),
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-ink">Tecnologías</h3>
        <span className="text-sm tabular-nums text-muted">{stack.length} elegidas</span>
      </div>

      <div className="flex flex-col gap-3">
        <Step n={1} title="Lenguajes" hint="Elige uno o varios. Con ellos se abren los frameworks y herramientas que los usan." />
        <div className="max-w-xl">
          <NewProjectStackSection section={languages} columns />
        </div>
        {shared.length > 0 && (
          <p className="flex flex-wrap items-center gap-1 text-sm text-muted">
            Las otras piezas usan
            {shared.map((language) => (
              <button
                key={language}
                type="button"
                onClick={() => toggleIn("stack", language)}
                className="rounded-sm border border-line px-1.5 py-0.5 text-xs text-ink-soft transition-colors hover:border-brand hover:text-ink"
              >
                + {language}
              </button>
            ))}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Step
          n={2}
          title="Frameworks, datos y tests"
          hint={
            chosenLanguages.length
              ? `Compatibles con ${chosenLanguages.join(", ")} en las plataformas elegidas.`
              : "Aparecen cuando eliges al menos un lenguaje."
          }
        />
        {chosenLanguages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            Elige un lenguaje en el paso 1, o usa la recomendación de arriba para empezar con un stack completo.
          </p>
        ) : (
          <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => (
              <NewProjectStackSection key={section.category} section={section} />
            ))}
          </div>
        )}
      </div>
      <NewProjectTechSearch others={stack.filter((s) => !known.has(s))} />
    </section>
  );
};

export default NewProjectStackGroups;
