import ChoiceCard from "@/components/ui/choice-card/choice-card";
import useWizardStore, { type SourceKind } from "@/stores/use-wizard-store";
import NewProjectSourceGithub from "./new-project-source-github";
import NewProjectGithubFiles from "./new-project-github-files";
import NewProjectSourceLocal from "./new-project-source-local";
import NewProjectSourceNew from "./new-project-source-new";

const SOURCES: { id: SourceKind; title: string; description: string }[] = [
  { id: "scratch", title: "Desde cero", description: "Sin repositorio por ahora" },
  { id: "new", title: "Repositorio nuevo", description: "Crea una carpeta con git en este equipo" },
  { id: "local", title: "Repositorio local", description: "Una carpeta git en este equipo" },
  { id: "github", title: "Clonar de GitHub", description: "Se clona en una carpeta local" },
];

const NewProjectSource = () => {
  const source = useWizardStore((s) => s.source);
  const setSource = useWizardStore((s) => s.setSource);
  const repo = useWizardStore((s) => s.repo);

  return (
    <div className="flex flex-col gap-6">
      <div role="radiogroup" aria-label="Origen del proyecto" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      {source === "new" && <NewProjectSourceNew />}
      {source === "local" && <NewProjectSourceLocal />}
      {source === "github" && <NewProjectSourceGithub />}
      {repo && !repo.existingProjectId && !repo.projectFile && <NewProjectGithubFiles />}
    </div>
  );
};

export default NewProjectSource;
