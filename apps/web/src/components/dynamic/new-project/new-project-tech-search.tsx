import { STACK_OPTIONS, suggestTechnologies, TECH_KIND_LABEL } from "@agent-tracking/core";
import { useCallback } from "react";
import useWizardStore from "@/stores/use-wizard-store";
import NewProjectSuggestField from "./new-project-suggest-field";

const catalog = new Map(STACK_OPTIONS.map((o) => [o.name.toLowerCase(), o.name]));

const NewProjectTechSearch = ({ others }: { others: string[] }) => {
  const platforms = useWizardStore((s) => s.platforms);
  const stack = useWizardStore((s) => s.stack);
  const toggleIn = useWizardStore((s) => s.toggleIn);

  const suggest = useCallback(
    (query: string) =>
      suggestTechnologies(query, platforms, stack).map(({ name, kind }) => ({ value: name, label: name, meta: TECH_KIND_LABEL[kind] })),
    [platforms, stack],
  );

  const add = (value: string) => {
    // A typed "nextjs" or "Next.js" selects that option above, with its usual rules.
    const key = value.toLowerCase();
    const name = catalog.get(key) ?? [...catalog.values()].find((n) => n.toLowerCase().replace(/[^a-z0-9]/g, "") === key.replace(/[^a-z0-9]/g, "")) ?? value;
    if (!stack.some((s) => s.toLowerCase() === name.toLowerCase())) toggleIn("stack", name);
  };

  return (
    <NewProjectSuggestField
      label="Otras tecnologías"
      placeholder="Busca por nombre o uso, por ejemplo GraphQL, pagos o push"
      suggest={suggest}
      onAdd={add}
      entries={others}
      onRemove={(name) => toggleIn("stack", name)}
    />
  );
};

export default NewProjectTechSearch;
