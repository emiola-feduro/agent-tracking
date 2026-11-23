import { DATABASE_KIND_LABEL, DATABASE_OPTIONS, suggestDatabases } from "@agent-tracking/core";
import { useCallback } from "react";
import useWizardStore from "@/stores/use-wizard-store";
import NewProjectSuggestField from "./new-project-suggest-field";

const featured = new Map(DATABASE_OPTIONS.map((o) => [o.name.toLowerCase(), o.name]));

const NewProjectDatabaseSearch = ({ others }: { others: string[] }) => {
  const platforms = useWizardStore((s) => s.platforms);
  const databases = useWizardStore((s) => s.databases);
  const toggleIn = useWizardStore((s) => s.toggleIn);

  const suggest = useCallback(
    (query: string) =>
      suggestDatabases(query, platforms, databases).map(({ name, kind }) => ({ value: name, label: name, meta: DATABASE_KIND_LABEL[kind] })),
    [platforms, databases],
  );

  const add = (value: string) => {
    // A typed "postgresql" selects the PostgreSQL checkbox instead of a duplicate entry.
    const name = featured.get(value.toLowerCase()) ?? value;
    if (!databases.some((d) => d.toLowerCase() === name.toLowerCase())) toggleIn("databases", name);
  };

  return (
    <NewProjectSuggestField
      label="Otras bases de datos"
      placeholder="Busca por nombre o tipo, por ejemplo DynamoDB o vectorial"
      suggest={suggest}
      onAdd={add}
      entries={others}
      onRemove={(name) => toggleIn("databases", name)}
    />
  );
};

export default NewProjectDatabaseSearch;
