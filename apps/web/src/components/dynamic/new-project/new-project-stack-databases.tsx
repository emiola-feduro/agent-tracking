import { DATABASE_KIND_LABEL, DATABASE_OPTIONS } from "@agent-tracking/core";
import CheckOption from "@/components/ui/check-option/check-option";
import useWizardStore from "@/stores/use-wizard-store";
import NewProjectDatabaseSearch from "./new-project-database-search";

const featured = new Set(DATABASE_OPTIONS.map((o) => o.name));

const NewProjectStackDatabases = () => {
  const databases = useWizardStore((s) => s.databases);
  const toggleIn = useWizardStore((s) => s.toggleIn);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-ink">Bases de datos</h3>
        <span className="text-sm tabular-nums text-muted">{databases.length} elegidas</span>
      </div>
      <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
        {DATABASE_OPTIONS.map(({ name, kind }) => (
          <CheckOption
            key={name}
            checked={databases.includes(name)}
            onChange={() => toggleIn("databases", name)}
            label={name}
            meta={<span className="text-sm font-normal text-muted">{DATABASE_KIND_LABEL[kind]}</span>}
          />
        ))}
      </div>
      <NewProjectDatabaseSearch others={databases.filter((d) => !featured.has(d))} />
    </section>
  );
};

export default NewProjectStackDatabases;
