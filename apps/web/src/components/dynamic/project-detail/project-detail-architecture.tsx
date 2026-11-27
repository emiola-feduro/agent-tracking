import { architectureLayers, recommendArchitecture, type ArchitectureLayer, type ProjectArchitecture } from "@agent-tracking/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import ArchitecturePicker from "@/components/dynamic/architecture/architecture-picker";
import { api, type ProjectView } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/**
 * The project's architecture, changeable at any time: saved at once, and CONTEXT.md follows so the
 * agents' next tasks use it. A layer never chosen shows the recommendation without applying it.
 */
const ProjectDetailArchitecture = ({ view }: { view: ProjectView }) => {
  const { project } = view;
  const kinds = project.structure === "monorepo" && project.parts?.length ? project.parts.map((p) => p.kind) : [project.kind ?? "fullstack"];
  const layers = architectureLayers(kinds);
  const saved = project.architecture ?? {};
  const [current, setCurrent] = useState<ProjectArchitecture>(saved);
  useEffect(() => setCurrent(saved), [JSON.stringify(saved)]); // eslint-disable-line react-hooks/exhaustive-deps
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (next: ProjectArchitecture) => (setCurrent(next), api.updateProject(project.id, { architecture: next })),
    onError: () => setCurrent(saved),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.project(project.id) }),
  });
  if (!layers.length) return null;

  const choices = layers.map((layer) => ({
    layer,
    recommended: recommendArchitecture(layer, { kinds, stack: project.stack, pieces: project.parts?.length ?? 1 }),
    chosen: current[layer] ?? null,
  }));
  const choose = (layer: ArchitectureLayer, id: string | null) => save.mutate({ ...current, [layer]: id });

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5" aria-labelledby="project-architecture-title">
      <div>
        <h2 id="project-architecture-title" className="font-semibold text-ink">
          Arquitectura
        </h2>
        <p className="text-sm text-muted">
          Cómo se organiza el código. Se guarda al elegir y va en el contexto del proyecto, así que los agentes la siguen desde su próxima tarea.
        </p>
      </div>
      <ArchitecturePicker choices={choices} onChoose={choose} />
      {save.isError && <p className="text-sm text-danger">{(save.error as Error).message}</p>}
    </section>
  );
};

export default ProjectDetailArchitecture;
