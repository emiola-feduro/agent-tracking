import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import CommitConventionsEditor from "@/components/dynamic/commit-conventions/commit-conventions-editor";
import Button from "@/components/ui/button/button";
import { api, type ProjectView } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** The project's commit and branch conventions, editable; saving rewrites CONTEXT.md for agents. */
const ProjectDetailConventions = ({ view }: { view: ProjectView }) => {
  const { project } = view;
  const saved = project.commitConventions ?? null;
  const [draft, setDraft] = useState(saved);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: () => api.updateProject(project.id, { commitConventions: draft }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.project(project.id) }),
  });
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);

  return (
    <section aria-labelledby="conventions-title" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <h2 id="conventions-title" className="font-semibold text-ink">
        Convenciones de commits y ramas
      </h2>
      <CommitConventionsEditor value={draft} onChange={setDraft} />
      {save.isError && <p className="text-sm text-danger">{(save.error as Error).message}</p>}
      <div className="flex gap-2">
        <Button variant="primary" size="sm" disabled={!changed} isLoading={save.isPending} onClick={() => save.mutate()}>
          Guardar convenciones
        </Button>
        {changed && (
          <Button variant="ghost" size="sm" onClick={() => setDraft(saved)}>
            Descartar cambios
          </Button>
        )}
      </div>
    </section>
  );
};

export default ProjectDetailConventions;
