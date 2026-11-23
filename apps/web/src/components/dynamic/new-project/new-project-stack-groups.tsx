import { STACK_OPTIONS } from "@agent-tracking/core";
import useStackSections from "@/hooks/form/use-stack-sections";
import useWizardStore from "@/stores/use-wizard-store";
import NewProjectTechSearch from "./new-project-tech-search";
import NewProjectStackSection from "./new-project-stack-section";

const known = new Set(STACK_OPTIONS.map((o) => o.name));

const NewProjectStackGroups = () => {
  const stack = useWizardStore((s) => s.stack);
  const sections = useStackSections();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-ink">Tecnologías</h3>
        <span className="text-sm tabular-nums text-muted">{stack.length} elegidas</span>
      </div>
      <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <NewProjectStackSection key={section.category} section={section} />
        ))}
      </div>
      <NewProjectTechSearch others={stack.filter((s) => !known.has(s))} />
    </section>
  );
};

export default NewProjectStackGroups;
