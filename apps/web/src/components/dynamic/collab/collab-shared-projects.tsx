import { useState } from "react";
import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import TextField from "@/components/ui/text-field/text-field";
import { useCollabConnection, useJoinProject, useSharedProjects } from "@/hooks/data/use-collab";
import { roleLabel, type SharedProjectItem } from "@/lib/collab-api";

const JoinRow = ({ project }: { project: SharedProjectItem }) => {
  const [repoPath, setRepoPath] = useState("");
  const join = useJoinProject();
  return (
    <li className="flex flex-col gap-3 py-3">
      <p className="text-ink">
        <span className="font-medium">{project.name}</span> <span className="text-sm text-muted">({roleLabel(project.role)})</span>
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <TextField
          label={`Carpeta del repositorio de ${project.name}`}
          value={repoPath}
          onChange={setRepoPath}
          placeholder="/home/tu-usuario/repos/proyecto"
          hint="Tu copia local del repositorio"
          className="flex-1"
        />
        <Button isLoading={join.isPending} disabled={!repoPath.trim()} onClick={() => join.mutate({ projectId: project.id, repoPath: repoPath.trim() })}>
          Traer a este equipo
        </Button>
      </div>
      {join.isError && <Alert>{join.error.message}</Alert>}
    </li>
  );
};

/** Projects shared with this person on the server that this machine does not have yet. */
const CollabSharedProjects = ({ localIds }: { localIds: string[] }) => {
  const { data: conn } = useCollabConnection();
  const { data: projects = [] } = useSharedProjects(!!conn?.connected);
  const missing = projects.filter((p) => !localIds.includes(p.id));
  if (missing.length === 0) return null;

  return (
    <section aria-labelledby="collab-shared" className="mt-8 flex flex-col gap-2 rounded-lg border border-line bg-surface p-5">
      <h2 id="collab-shared" className="text-lg font-semibold text-ink">
        Compartidos contigo
      </h2>
      <ul className="flex flex-col divide-y divide-line">
        {missing.map((p) => (
          <JoinRow key={p.id} project={p} />
        ))}
      </ul>
    </section>
  );
};

export default CollabSharedProjects;
