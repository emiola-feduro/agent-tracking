import { useState, type FormEvent } from "react";
import Button from "@/components/ui/button/button";
import RemoveButton from "@/components/ui/remove-button/remove-button";
import useProjectActions from "@/hooks/data/use-project-actions";
import type { ProjectView } from "@/lib/api";

const ProjectDetailRules = ({ view }: { view: ProjectView }) => {
  const { project, rules } = view;
  const [draft, setDraft] = useState("");
  const { addRule, deleteRule } = useProjectActions(project.id);
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.trim()) addRule.mutate(draft.trim(), { onSuccess: () => setDraft("") });
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      {sorted.length === 0 && <p className="text-muted">No hay reglas de negocio.</p>}
      <ol className="flex flex-col divide-y divide-line">
        {sorted.map(({ id, text }, index) => (
          <li key={id} className="flex animate-enter items-center gap-3 py-2">
            <span className="w-6 text-right text-sm tabular-nums text-muted">{index + 1}</span>
            <span className="flex-1">{text}</span>
            <RemoveButton label={`Eliminar regla ${index + 1}`} onClick={() => deleteRule.mutate(id)} />
          </li>
        ))}
      </ol>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nueva regla de negocio"
          aria-label="Nueva regla de negocio"
          className="min-h-10 w-full rounded-md border border-line-strong bg-surface px-3 placeholder:text-muted"
        />
        <Button type="submit" isLoading={addRule.isPending} disabled={!draft.trim()}>
          Agregar
        </Button>
      </form>
    </section>
  );
};

export default ProjectDetailRules;
