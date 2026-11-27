import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import CommitDialog from "@/components/dynamic/git-actions/commit-dialog";
import IntegrateOutcomeView from "@/components/dynamic/git-actions/integrate-outcome";
import { api } from "@/lib/api";
import Button from "@/components/ui/button/button";
import StatusPill from "@/components/ui/status-pill/status-pill";
import useIntegrate from "@/hooks/data/use-integrate";
import { useLocalBranches, useWorktrees } from "@/hooks/data/use-worktrees";
import { formatRelative } from "@/lib/activity";

/**
 * Work branches with commits the main branch does not have, each with one button to bring it into
 * main and push it. Git problems (conflicts, unfinished work, a rejected push) are shown here.
 */
const ProjectDetailIntegrate = ({ projectId }: { projectId: string }) => {
  const branches = useLocalBranches(projectId);
  const worktrees = useWorktrees(projectId);
  const base = worktrees.data?.base ?? "main";
  const { integrate, outcome, setOutcome, clearOutcome, busyBranch, isPending } = useIntegrate(projectId, base);
  const ready = (branches.data?.branches ?? []).filter((b) => b.name !== base && b.unmerged > 0);
  const changes = useQuery({ queryKey: ["projects", projectId, "working-changes", null], queryFn: () => api.workingChanges(projectId), refetchInterval: 30_000 });
  const dirty = changes.data?.files.length ?? 0;
  const current = branches.data?.current ?? null;
  const [committing, setCommitting] = useState(false);
  if (!ready.length && !outcome && !dirty) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5" aria-labelledby="integrate-title">
      <div>
        <h2 id="integrate-title" className="font-semibold text-ink">
          Listo para integrar en {base}
        </h2>
        <p className="text-sm text-muted">
          Ramas con commits que {base} todavía no tiene. La fusión se hace aparte, sin tocar lo que tengas abierto; si hay conflictos no se cambia nada.
        </p>
      </div>
      {outcome && <IntegrateOutcomeView projectId={projectId} outcome={outcome} onClose={clearOutcome} onChange={setOutcome} integrate={(b, push) => integrate(b, push)} />}
      {dirty > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-subtle px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 text-ink">
            {dirty === 1 ? "Hay 1 cambio sin commit" : `Hay ${dirty} cambios sin commit`} en el checkout principal
            {current ? (
              <>
                {" "}
                (rama <code className="font-mono">{current}</code>)
              </>
            ) : null}
            .
          </span>
          <Button size="sm" onClick={() => setCommitting(true)}>
            Hacer commit…
          </Button>
        </div>
      )}
      <CommitDialog projectId={projectId} open={committing} onClose={() => setCommitting(false)} where={current ? `el checkout principal (rama ${current})` : undefined} />
      <ul className="flex flex-col divide-y divide-line">
        {ready.map((b) => (
          <li key={b.name} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-[0.875rem] text-ink">{b.name}</code>
                <span className="text-sm text-muted tabular-nums">{b.unmerged === 1 ? "1 commit nuevo" : `${b.unmerged} commits nuevos`}</span>
                {b.current && <StatusPill tone="brand">Checkout principal</StatusPill>}
                {b.agent && <StatusPill tone="warn">Un agente trabaja aquí</StatusPill>}
              </span>
              <span className="truncate text-sm text-ink-soft">
                {b.subject} <span className="text-muted">({formatRelative(b.lastCommitDate)})</span>
              </span>
              {b.agent && <span className="text-xs text-muted">Se podrá integrar cuando el agente termine.</span>}
            </div>
            <span className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={b.agent || isPending} onClick={() => integrate(b.name, false, b.unmerged)}>
                Solo integrar
              </Button>
              <Button size="sm" variant="primary" disabled={b.agent || isPending} isLoading={busyBranch === b.name} onClick={() => integrate(b.name, true, b.unmerged)}>
                Integrar y subir
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {ready.length === 0 && <p className="text-sm text-muted">No quedan ramas por integrar.</p>}
    </section>
  );
};

export default ProjectDetailIntegrate;
