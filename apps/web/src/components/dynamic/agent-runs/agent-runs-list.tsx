import { useEffect, useState } from "react";
import Button from "@/components/ui/button/button";
import StatusPill from "@/components/ui/status-pill/status-pill";
import useAgentRuns from "@/hooks/data/use-agent-runs";
import type { AgentRun } from "@/lib/api";

const LABEL: Record<AgentRun["agent"], string> = { "claude-code": "Claude Code", codex: "Codex CLI", "gemini-cli": "Gemini CLI" };
const STATUS: Record<AgentRun["status"], { text: string; tone: "brand" | "ok" | "danger" | "neutral" }> = {
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
  const [now, setNow] = useState(Date.now());
  const running = runs.data?.some((r) => r.status === "running");
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div>
        <h2 className="font-semibold text-ink">Trabajos lanzados</h2>
        <p className="text-sm text-muted">Agentes que arrancaste desde un requerimiento con «Implementar con un agente». Se borran al reiniciar el servidor.</p>
      </div>
      {runs.data?.length === 0 && <p className="text-sm text-muted">Todavía no lanzaste ninguno.</p>}
      <ul className="flex flex-col gap-3">
        {runs.data?.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 rounded-md border border-line p-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium text-ink">
                {LABEL[r.agent]} en {r.requirementCode ? <span className="font-mono text-brand">{r.requirementCode}</span> : null} {r.requirementTitle}
              </span>
              <StatusPill tone={STATUS[r.status].tone}>{STATUS[r.status].text}</StatusPill>
              <span className="text-sm text-muted tabular-nums">{duration(r.startedAt, r.endedAt, now)}</span>
              {r.permission === "full" && <StatusPill tone="warn">Sin preguntas</StatusPill>}
              {r.status === "running" && (
                <span className="ml-auto">
                  <Button size="sm" variant="danger" isLoading={stop.isPending && stop.variables === r.id} onClick={() => stop.mutate(r.id)}>
                    Detener
                  </Button>
                </span>
              )}
            </div>
            <p className="text-xs text-muted">
              En <code className="font-mono">{r.cwd}</code>
              {r.exitCode !== null && r.status !== "stopped" ? `, terminó con código ${r.exitCode}` : ""}
            </p>
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
