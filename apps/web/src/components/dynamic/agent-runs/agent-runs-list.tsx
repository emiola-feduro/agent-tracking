import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { queryKeys } from "@/lib/query-keys";
import IntegrateOutcomeView from "@/components/dynamic/git-actions/integrate-outcome";
import Button from "@/components/ui/button/button";
import useIntegrate from "@/hooks/data/use-integrate";
import { useLocalBranches, useWorktrees } from "@/hooks/data/use-worktrees";
import StatusPill from "@/components/ui/status-pill/status-pill";
import useAgentRuns from "@/hooks/data/use-agent-runs";
import type { AgentRun } from "@/lib/api";

const LABEL: Record<AgentRun["agent"], string> = { "claude-code": "Claude Code", codex: "Codex CLI", "gemini-cli": "Gemini CLI" };
const STATUS: Record<AgentRun["status"], { text: string; tone: "brand" | "ok" | "danger" | "neutral" | "warn" }> = {
  queued: { text: "En cola", tone: "warn" },
  running: { text: "Trabajando", tone: "brand" },
  done: { text: "Terminó", tone: "ok" },
  failed: { text: "Falló", tone: "danger" },
  stopped: { text: "Detenido", tone: "neutral" },
};

const duration = (from: string, to: string | null, now: number) => {
  const s = Math.max(0, Math.round(((to ? Date.parse(to) : now) - Date.parse(from)) / 1000));
  return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
};

/** Agents started from the app: status, how long, the last lines they printed, and a way to stop them. */
const AgentRunsList = ({ projectId }: { projectId: string }) => {
  const { runs, stop } = useAgentRuns(projectId);
  const branches = useLocalBranches(projectId);
  const worktrees = useWorktrees(projectId);
  const base = worktrees.data?.base ?? "main";
  const { integrate, outcome, setOutcome, clearOutcome, busyBranch, isPending } = useIntegrate(projectId, base);
  /** Commits the branch has that the base does not (0: nothing left to integrate). */
  const pendingOn = (branch: string | null) => (branch && branch !== base ? (branches.data?.branches.find((b) => b.name === branch)?.unmerged ?? 0) : 0);
  const [now, setNow] = useState(Date.now());
  const running = runs.data?.some((r) => r.status === "running");
  // A run that just ended may have left commits: the branches list is read again.
  const finished = runs.data?.filter((r) => r.endedAt).length ?? 0;
  const queryClient = useQueryClient();
  useEffect(() => void queryClient.invalidateQueries({ queryKey: queryKeys.branches(projectId) }), [finished, projectId, queryClient]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div>
        <h2 className="font-semibold text-ink">Trabajos lanzados</h2>
        <p className="text-sm text-muted">Agentes que arrancaste con «Implementar». Si ya hay uno trabajando en la misma carpeta, el siguiente espera en cola. Se borran al reiniciar el servidor.</p>
      </div>
      {runs.data?.length === 0 && <p className="text-sm text-muted">Todavía no lanzaste ninguno.</p>}
      {outcome && <IntegrateOutcomeView projectId={projectId} outcome={outcome} onClose={clearOutcome} onChange={setOutcome} integrate={(b, push) => integrate(b, push)} />}
      <ul className="flex flex-col gap-3">
        {runs.data?.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 rounded-md border border-line p-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium text-ink">
                {LABEL[r.agent]}: {r.label}
              </span>
              <StatusPill tone={STATUS[r.status].tone}>{STATUS[r.status].text}</StatusPill>
              {r.startedAt && <span className="text-sm text-muted tabular-nums">{duration(r.startedAt, r.endedAt, now)}</span>}
              {r.permission === "full" && <StatusPill tone="warn">Sin preguntas</StatusPill>}
              {(r.status === "running" || r.status === "queued") && (
                <span className="ml-auto">
                  <Button size="sm" variant="danger" isLoading={stop.isPending && stop.variables === r.id} onClick={() => stop.mutate(r.id)}>
                    {r.status === "queued" ? "Quitar de la cola" : "Detener"}
                  </Button>
                </span>
              )}
            </div>
            {r.tasks.length > 1 && (
              <ol className="list-decimal pl-5 text-sm text-ink-soft">
                {r.tasks.map((t) => (
                  <li key={t.requirementId}>
                    {t.code && <span className="font-mono text-brand">{t.code}</span>} {t.title}
                    {t.criteria !== null && <span className="text-muted"> ({t.criteria === 1 ? "1 criterio" : `${t.criteria} criterios`})</span>}
                  </li>
                ))}
              </ol>
            )}
            <p className="text-xs text-muted">
              {r.status === "queued" ? "Espera a que termine el agente que trabaja en " : "En "}
              <code className="font-mono">{r.cwd}</code>
              {r.exitCode !== null && r.status !== "stopped" ? `, terminó con código ${r.exitCode}` : ""}
            </p>
            {(r.status === "done" || r.status === "failed") && pendingOn(r.workBranch) > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-brand-soft px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 text-ink">
                  Dejó {pendingOn(r.workBranch) === 1 ? "1 commit" : `${pendingOn(r.workBranch)} commits`} en <code className="font-mono">{r.workBranch}</code> que {base} todavía no tiene.
                </span>
                <Button size="sm" variant="ghost" disabled={isPending} onClick={() => integrate(r.workBranch!, false, pendingOn(r.workBranch))}>
                  Solo integrar
                </Button>
                <Button size="sm" variant="primary" disabled={isPending} isLoading={busyBranch === r.workBranch} onClick={() => integrate(r.workBranch!, true, pendingOn(r.workBranch))}>
                  Integrar y subir
                </Button>
              </div>
            )}
            {r.output.length > 0 && (
              <pre className="max-h-48 overflow-auto rounded-md bg-subtle p-3 font-mono text-xs whitespace-pre-wrap text-ink-soft">{r.output.slice(-20).join("\n")}</pre>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default AgentRunsList;
