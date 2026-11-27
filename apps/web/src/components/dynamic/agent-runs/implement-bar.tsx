import { dodImplementable, requirementImplementable } from "@agent-tracking/core";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import Button from "@/components/ui/button/button";
import useImplement from "@/hooks/data/use-implement";
import type { ProjectView } from "@/lib/api";
import useImplementStore, { selectionItems } from "@/stores/use-implement-store";

/**
 * Bottom bar of the requirements page: while choosing, how many requirements and criteria are picked
 * and one button to hand them all to one agent; after a launch, who started (or queued) and a link to
 * the runs.
 */
const ImplementBar = ({ view }: { view: ProjectView }) => {
  const projectId = view.project.id;
  const { selecting, requirements, dod, notice, setSelecting, clear, setNotice } = useImplementStore();
  const options = useImplementStore((s) => s.openDialog);
  const { implement, isLaunching } = useImplement(projectId);
  // Picks that stopped being implementable (a criterion done meanwhile) are left out.
  const items = selectionItems({ requirements, dod }, view.requirements, view.dod).filter((i) =>
    i.dodIds
      ? i.dodIds.every((id) => dodImplementable(view.dod.find((d) => d.id === id) ?? { status: "done" }))
      : requirementImplementable(view.dod.filter((d) => d.requirementId === i.requirementId)),
  );
  const nReq = items.filter((i) => !i.dodIds).length;
  const nDod = items.reduce((n, i) => n + (i.dodIds?.length ?? 0), 0);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(t);
  }, [notice, setNotice]);

  if (!selecting && !notice) return null;
  const summary = [nReq && `${nReq === 1 ? "1 requerimiento" : `${nReq} requerimientos`}`, nDod && `${nDod === 1 ? "1 criterio" : `${nDod} criterios`}`]
    .filter(Boolean)
    .join(" y ");

  return (
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-line-strong bg-surface px-4 py-3 shadow-lg" role="region" aria-label="Implementar">
      {notice ? (
        <p className="min-w-0 flex-1 text-sm text-ink" aria-live="polite">
          {"error" in notice ? (
            <span className="text-danger">{notice.error}</span>
          ) : notice.run.status === "queued" ? (
            <>
              {notice.agentLabel} tomará {notice.run.label} cuando termine lo que tiene en curso en esa carpeta.
            </>
          ) : (
            <>
              {notice.agentLabel} empezó a trabajar en {notice.run.label}.
            </>
          )}{" "}
          {!("error" in notice) && (
            <Link to="/projects/$projectId" params={{ projectId }} search={(prev: Record<string, unknown>) => ({ ...prev, tab: "agents" }) as never} className="font-medium text-brand hover:underline">
              Ver trabajos lanzados
            </Link>
          )}
        </p>
      ) : (
        <>
          <p className="min-w-0 flex-1 text-sm text-ink" aria-live="polite">
            {items.length ? `${summary} para un agente, en el orden de la lista.` : "Marca los requerimientos o los criterios pendientes que quieras implementar."}
          </p>
          {items.length > 0 && (
            <Button size="sm" variant="ghost" onClick={clear}>
              Limpiar
            </Button>
          )}
          <Button size="sm" disabled={!items.length} onClick={() => options(items)}>
            Opciones
          </Button>
          <Button size="sm" variant="primary" disabled={!items.length} isLoading={isLaunching} onClick={() => implement(items, undefined, () => setSelecting(false))}>
            Implementar
          </Button>
        </>
      )}
      <Button size="sm" variant="ghost" onClick={() => (notice ? setNotice(null) : setSelecting(false))}>
        {notice ? "Cerrar" : "Cancelar"}
      </Button>
    </div>
  );
};

export default ImplementBar;
