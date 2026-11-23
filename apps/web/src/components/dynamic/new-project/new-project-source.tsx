import ChoiceCard from "@/components/ui/choice-card/choice-card";
import useWizardStore, { type SourceKind } from "@/stores/use-wizard-store";
import NewProjectSourceGithub from "./new-project-source-github";
import NewProjectSourceLocal from "./new-project-source-local";

const SOURCES: { id: SourceKind; title: string; description: string }[] = [
  { id: "scratch", title: "Desde cero", description: "Defines todo en este asistente" },
  { id: "local", title: "Repositorio local", description: "Una carpeta git en este equipo" },
  { id: "github", title: "Clonar de GitHub", description: "Se clona en una carpeta local" },
];

const NewProjectSource = () => {
  const source = useWizardStore((s) => s.source);
  const setSource = useWizardStore((s) => s.setSource);

  return (
    <div className="flex flex-col gap-6">
      <div role="radiogroup" aria-label="Origen del proyecto" className="grid gap-3 sm:grid-cols-3">
        {SOURCES.map(({ id, title, description }) => (
          <ChoiceCard
            key={id}
            mode="radio"
            title={title}
            description={description}
            selected={source === id}
            onSelect={() => setSource(id)}
          />
        ))}
      </div>
      {source === "local" && <NewProjectSourceLocal />}
      {source === "github" && <NewProjectSourceGithub />}
    </div>
  );
};

export default NewProjectSource;
