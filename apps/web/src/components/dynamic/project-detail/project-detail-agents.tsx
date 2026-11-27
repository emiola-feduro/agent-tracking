import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import AgentPlanDialog from "@/components/dynamic/agents/agent-plan-dialog";
import ReplyLanguageField from "@/components/dynamic/agents/reply-language-field";
import Button from "@/components/ui/button/button";
import CheckOption from "@/components/ui/check-option/check-option";
import Skeleton from "@/components/ui/skeleton/skeleton";
import StatusPill from "@/components/ui/status-pill/status-pill";
import type { ReplyLanguage } from "@agent-tracking/core";
import { api, type AgentInfo, type AgentKind, type ProjectView } from "@/lib/api";
import { formatRelative } from "@/lib/activity";
import { queryKeys } from "@/lib/query-keys";

const NOTES: Partial<Record<AgentKind, string>> = {
  codex: "Codex solo ejecuta hooks en los que confías. Después de conectar, abre Codex, escribe /hooks y confía en los de Agent Tracking; si no, no verás nada en vivo.",
  "gemini-cli": "En el plan gratuito y en Google One, Gemini CLI fue reemplazado por Antigravity CLI en junio de 2026.",
};

const Check = ({ ok, label }: { ok: boolean; label: string }) => (
  <span className={`inline-flex items-center gap-1.5 text-sm ${ok ? "text-ok" : "text-muted"}`}>
    <span aria-hidden>{ok ? "✓" : "○"}</span>
    {label}
  </span>
);

/**
 * The coding agents on this machine and how they reach Agent Tracking (MCP for reporting, hooks for
 * the live view and the summary of each piece of work), plus which of them work on this project.
 */
const ProjectDetailAgents = ({ view }: { view: ProjectView }) => {
  const { project } = view;
  const agents = useQuery({ queryKey: queryKeys.agents, queryFn: api.agents });
  const [dialog, setDialog] = useState<{ agent: AgentInfo; action: "connect" | "disconnect" } | null>(null);
  const queryClient = useQueryClient();
  const saved = (project.agents ?? []) as AgentKind[];
  // Shown at once; the server writes the instruction files and the project refreshes after.
  const [chosen, setChosen] = useState(saved);
  useEffect(() => setChosen(saved), [saved.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: (next: AgentKind[]) => (setChosen(next), api.updateProject(project.id, { agents: next })),
    onError: () => setChosen(saved),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.project(project.id) }),
  });

  const savedLanguage = project.replyLanguage ?? null;
  const [language, setLanguage] = useState(savedLanguage);
  useEffect(() => setLanguage(savedLanguage), [savedLanguage]);
  const saveLanguage = useMutation({
    mutationFn: (next: ReplyLanguage | null) => (setLanguage(next), api.updateProject(project.id, { replyLanguage: next })),
    onError: () => setLanguage(savedLanguage),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.project(project.id) }),
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-ink">Agentes en este equipo</h2>
          <p className="text-sm text-muted">
            Con el MCP, el agente lee el contexto y reporta lo que hizo. Con los hooks, ves en vivo lo que hace y el resumen de cada trabajo, sin gastar
            tokens.
          </p>
        </div>
        {agents.isPending && <Skeleton className="h-32" />}
        {agents.isError && <p className="text-sm text-danger">{(agents.error as Error).message}</p>}
        <ul className="grid gap-3 lg:grid-cols-3">
          {agents.data?.map((a) => {
            const connected = a.mcp && !a.mcpOutdated && a.hooks;
            const outdated = a.mcpOutdated || a.hooksOutdated;
            return (
              <li key={a.kind} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{a.label}</p>
                    <p className="text-xs text-muted">{a.installed ? "Instalado en este equipo" : "No encontrado en este equipo"}</p>
                  </div>
                  {connected ? <StatusPill tone="ok">Conectado</StatusPill> : a.mcp || a.hooks ? <StatusPill tone="warn">A medias</StatusPill> : null}
                </div>
                <div className="flex flex-col gap-1">
                  <Check ok={a.mcp} label="MCP: lee el contexto y reporta" />
                  <Check ok={a.hooks} label="Hooks: en vivo, resumen y protección de main" />
                </div>
                {a.mcpOutdated && (
                  <p className="text-xs text-warn">
                    El MCP corre como proceso local: tras cada actualización se queda con el código viejo. Actualízalo para conectarlo por HTTP.
                  </p>
                )}
                {a.hooksOutdated && (
                  <p className="text-xs text-warn">Los hooks son de una versión anterior y no protegen main ni recuerdan reportar: conéctalo de nuevo para actualizarlos.</p>
                )}
                <p className="text-xs text-muted">
                  Instrucciones en <code className="font-mono">{a.contextFile}</code>
                  {a.lastSeen ? `. Último trabajo ${formatRelative(a.lastSeen)}.` : a.mcp || a.hooks ? ". Todavía no llegó ningún trabajo suyo." : "."}
                </p>
                {NOTES[a.kind] && <p className="text-xs text-muted">{NOTES[a.kind]}</p>}
                <div className="mt-auto flex gap-2">
                  {!connected && (
                    <Button size="sm" variant="primary" onClick={() => setDialog({ agent: a, action: "connect" })}>
                      {outdated ? "Actualizar" : "Conectar"}
                    </Button>
                  )}
                  {(a.mcp || a.hooks) && (
                    <Button size="sm" variant="ghost" onClick={() => setDialog({ agent: a, action: "disconnect" })}>
                      Desconectar
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <h2 className="font-semibold text-ink">Agentes que trabajan en este proyecto</h2>
        <p className="text-sm text-muted">
          A cada uno se le agrega, en su archivo de instrucciones del repositorio, un bloque corto que apunta al contexto del proyecto, explica cómo
          reportar y fija las reglas de git (trabajar en ramas, hacer commits, no tocar main). El resto del archivo no se toca. Un agente se agrega
          solo la primera vez que trabaja en el proyecto.
        </p>
        {!project.repoPath && <p className="text-sm text-warn">El proyecto no tiene repositorio local: no hay dónde escribir esos archivos.</p>}
        {(agents.data ?? []).map((a) => (
          <CheckOption
            key={a.kind}
            checked={chosen.includes(a.kind)}
            onChange={() => save.mutate(chosen.includes(a.kind) ? chosen.filter((k) => k !== a.kind) : [...chosen, a.kind])}
            label={a.label}
            meta={<code className="font-mono text-xs font-normal text-muted">{a.contextFile}</code>}
          />
        ))}
        {save.isError && <p className="text-sm text-danger">{(save.error as Error).message}</p>}
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <h2 className="font-semibold text-ink">Idioma con el usuario</h2>
        <p className="text-sm text-muted">
          Va en el contexto del proyecto y en el archivo de instrucciones de cada agente. Claude Code y Codex lo reciben además con cada pedido, así
          que un cambio aplica también en las sesiones que ya están abiertas.
        </p>
        <ReplyLanguageField value={language} onChange={(v) => saveLanguage.mutate(v)} />
        {saveLanguage.isError && <p className="text-sm text-danger">{(saveLanguage.error as Error).message}</p>}
      </section>

      <AgentPlanDialog agent={dialog?.agent ?? null} action={dialog?.action ?? "connect"} onClose={() => setDialog(null)} />
    </div>
  );
};

export default ProjectDetailAgents;
