import { useState, type FormEvent } from "react";
import Button from "@/components/ui/button/button";
import RemoveButton from "@/components/ui/remove-button/remove-button";
import StatusPill from "@/components/ui/status-pill/status-pill";
import useProjectActions from "@/hooks/data/use-project-actions";
import type { DodItem } from "@/lib/api";
import { nextDodStatus } from "@/lib/labels";

type ProjectDetailDodProps = {
  projectId: string;
  requirementId: string;
  items: DodItem[];
};

const ProjectDetailDod = ({ projectId, requirementId, items }: ProjectDetailDodProps) => {
  const [draft, setDraft] = useState("");
  const { setDodStatus, deleteDod, addDod } = useProjectActions(projectId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const criterion = draft.trim();
    if (!criterion) return;
    addDod.mutate({ reqId: requirementId, criterion }, { onSuccess: () => setDraft("") });
  };

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-ink">Definition of Done</h3>
      <ul className="flex flex-col">
        {items.length === 0 && <li className="text-sm text-muted">Sin criterios.</li>}
        {items.map(({ id, criterion, status, origin }) => (
          <li key={id} className="group flex items-start gap-1">
            <label className="flex min-h-9 flex-1 cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-subtle">
              <input
                type="checkbox"
                checked={status === "done"}
                onChange={() => setDodStatus.mutate({ reqId: requirementId, dodId: id, status: nextDodStatus(status) })}
                className="mt-1 size-4 shrink-0 accent-ok"
              />
              <span className={`transition-colors duration-200 ${status === "done" ? "text-muted line-through" : "text-ink"}`}>
                {criterion}
              </span>
              {origin === "llm" && <StatusPill tone="brand">LLM</StatusPill>}
            </label>
            <RemoveButton label={`Quitar criterio ${criterion}`} onClick={() => deleteDod.mutate({ reqId: requirementId, dodId: id })} />
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nuevo criterio"
          aria-label="Nuevo criterio"
          className="min-h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm placeholder:text-muted"
        />
        <Button size="sm" type="submit" isLoading={addDod.isPending} disabled={!draft.trim()}>
          Agregar
        </Button>
      </form>
    </section>
  );
};

export default ProjectDetailDod;
