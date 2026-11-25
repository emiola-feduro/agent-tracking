import { Link } from "@tanstack/react-router";
import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import type useRepoSource from "@/hooks/form/use-repo-source";
import type { RepoInspection } from "@/lib/api";

type NewProjectRepoResultProps = {
  inspection: RepoInspection;
  importRepo: ReturnType<typeof useRepoSource>["importRepo"];
};

const NewProjectRepoResult = ({ inspection, importRepo }: NewProjectRepoResultProps) => {
  const { repo, projectFile, projectFileError, existingProjectId } = inspection;
  const { root, name, branch, remoteUrl } = repo;

  return (
    <div className="flex animate-enter flex-col gap-4 rounded-md border border-line bg-subtle p-4">
      <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="text-muted">Repositorio</dt>
        <dd className="font-medium">{name}</dd>
        <dt className="text-muted">Ruta</dt>
        <dd className="font-mono text-[0.8125rem] break-all">{root}</dd>
        <dt className="text-muted">Rama actual</dt>
        <dd>{branch ?? "Sin rama"}</dd>
        <dt className="text-muted">Remoto</dt>
        <dd>{remoteUrl ?? "Sin remoto origin"}</dd>
      </dl>

      {existingProjectId ? (
        <Alert
          tone="warn"
          action={
            <Link to="/projects/$projectId" params={{ projectId: existingProjectId }} search={{ tab: "overview" }} className="font-medium underline">
              Abrir proyecto
            </Link>
          }
        >
          Este repositorio ya está en Agent Tracking.
        </Alert>
      ) : projectFile ? (
        <div className="flex flex-col gap-3 rounded-md bg-surface p-4">
          <p>
            El repositorio ya tiene un proyecto: <strong>{projectFile.project.name}</strong>, con{" "}
            {projectFile.requirements.length} requerimientos y {projectFile.rules.length} reglas.
          </p>
          {importRepo.isError && <Alert>{importRepo.error.message}</Alert>}
          <div>
            <Button variant="primary" isLoading={importRepo.isPending} onClick={() => importRepo.mutate(root)}>
              Importar proyecto
            </Button>
          </div>
        </div>
      ) : projectFileError ? (
        <Alert tone="warn">
          Los datos de .agent-tracking no son válidos y se reemplazarán al crear el proyecto: {projectFileError}
        </Alert>
      ) : (
        <p className="text-sm text-ink-soft">
          Al crear el proyecto se guardará la carpeta <code className="font-mono">.agent-tracking</code> en este repositorio.
        </p>
      )}
    </div>
  );
};

export default NewProjectRepoResult;
