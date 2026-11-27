import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import StatusPill from "@/components/ui/status-pill/status-pill";
import { useLocalBranches, useWorktrees } from "@/hooks/data/use-worktrees";
import { formatRelative } from "@/lib/activity";
import { api, type IntegrateResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

type Outcome = { branch: string; tone: "info" | "warn" | "danger"; text: string };

/** What happened, in one or two sentences. */
const describe = (r: IntegrateResult): Outcome => {
  const how =
    r.merge === "already-merged" ? `${r.branch} ya estaba en ${r.base}` : r.merge === "fast-forward" ? `${r.branch} quedó en ${r.base}` : `${r.branch} se fusionó en ${r.base} con un commit de fusión`;
  const extra = [
    r.trackingCommits.length ? "Antes se guardaron los datos de Agent Tracking que estaban sin commit." : "",
    r.switchedBack ? `Tu checkout volvió a ${r.base}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (r.pushError) return { branch: r.branch, tone: "warn", text: `${how} en este equipo, pero no se subió. ${r.pushError} ${extra}`.trim() };
  return { branch: r.branch, tone: "info", text: `${how}${r.pushed ? ` y se subió a origin/${r.base}` : ""}. ${extra}`.trim() };
};

/**
 * Work branches with commits the main branch does not have, each with one button to bring it into
 * main and push it. Git problems (conflicts, unfinished work, a rejected push) are shown here.
 */
const ProjectDetailIntegrate = ({ projectId }: { projectId: string }) => {
  const branches = useLocalBranches(projectId);
  const worktrees = useWorktrees(projectId);
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const base = worktrees.data?.base ?? "main";
  const integrate = useMutation({
    mutationFn: ({ branch, push }: { branch: string; push: boolean }) => api.integrateBranch(projectId, branch, push),
    onSuccess: (r) => setOutcome(describe(r)),
    onError: (e, { branch }) => setOutcome({ branch, tone: "danger", text: (e as Error).message }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branches(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.worktrees(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    },
  });
  const ready = (branches.data?.branches ?? []).filter((b) => b.name !== base && b.unmerged > 0);
  if (!ready.length && !outcome) return null;

  const run = (branch: string, commits: number, push: boolean) => {
    const what = `${branch} (${commits === 1 ? "1 commit" : `${commits} commits`})`;
    if (!confirm(push ? `¿Integrar ${what} en ${base} y subirla a origin?` : `¿Integrar ${what} en ${base} solo en este equipo?`)) return;
    setOutcome(null);
    integrate.mutate({ branch, push });
  };

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
      {outcome && (
        <div className="flex items-start justify-between gap-3" aria-live="polite">
          <Alert tone={outcome.tone}>{outcome.text}</Alert>
          <Button size="sm" variant="ghost" onClick={() => setOutcome(null)}>
            Cerrar
          </Button>
        </div>
      )}
      <ul className="flex flex-col divide-y divide-line">
        {ready.map((b) => {
          const busy = integrate.isPending && integrate.variables?.branch === b.name;
          return (
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
              </div>
              <span className="flex gap-2">
                <Button size="sm" variant="ghost" disabled={b.agent || integrate.isPending} onClick={() => run(b.name, b.unmerged, false)}>
                  Solo integrar
                </Button>
                <Button size="sm" variant="primary" disabled={b.agent || integrate.isPending} isLoading={busy} onClick={() => run(b.name, b.unmerged, true)}>
                  Integrar y subir
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
      {ready.length === 0 && <p className="text-sm text-muted">No quedan ramas por integrar.</p>}
    </section>
  );
};

export default ProjectDetailIntegrate;
