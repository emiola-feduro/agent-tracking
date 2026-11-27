import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button/button";
import ChoiceCard from "@/components/ui/choice-card/choice-card";
import SelectField from "@/components/ui/select-field/select-field";
import TextAreaField from "@/components/ui/text-area-field/text-area-field";
import TextField from "@/components/ui/text-field/text-field";
import useImplement from "@/hooks/data/use-implement";
import { api, type AgentKind, type LaunchPermission, type ProjectView } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import useImplementStore, { readLaunchDefaults } from "@/stores/use-implement-store";

/**
 * The options behind "Implementar": which agent (only the installed ones), where it works (the main
 * checkout or a worktree), with what permissions, an optional model and extra instructions. The
 * choices are remembered for the next one-click launch on this project.
 */
const LaunchAgentDialog = ({ view, onLaunched }: { view: ProjectView; onLaunched?: () => void }) => {
  const projectId = view.project.id;
  const items = useImplementStore((s) => s.dialog);
  const close = useImplementStore((s) => s.closeDialog);
  const ref = useRef<HTMLDialogElement>(null);
  const agents = useQuery({ queryKey: queryKeys.agents, queryFn: api.agents, enabled: !!items });
  const worktrees = useQuery({ queryKey: queryKeys.worktrees(projectId), queryFn: () => api.worktrees(projectId), enabled: !!items });
  const { implement, isLaunching } = useImplement(projectId);
  const installed = (agents.data ?? []).filter((a) => a.installed);
  const [agent, setAgent] = useState<AgentKind | null>(null);
  const [cwd, setCwd] = useState("");
  const [permission, setPermission] = useState<LaunchPermission>("safe");
  const [model, setModel] = useState("");
  const [instructions, setInstructions] = useState("");
  const chosen = agent && installed.some((a) => a.kind === agent) ? agent : (installed.find((a) => a.kind === "claude-code") ?? installed[0])?.kind ?? null;
  const checkouts = worktrees.data?.worktrees ?? [];

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (items && !d.open) {
      const saved = readLaunchDefaults(projectId);
      setAgent(saved.agent);
      setCwd(saved.cwd);
      setPermission(saved.permission);
      setModel(saved.model);
      setInstructions("");
      d.showModal();
    }
    if (!items && d.open) d.close();
  }, [items, projectId]);

  const label = (items ?? [])
    .map((i) => {
      const r = view.requirements.find((x) => x.id === i.requirementId);
      const ref = r?.code ?? r?.title ?? "";
      return i.dodIds?.length ? `${i.dodIds.length === 1 ? "1 criterio" : `${i.dodIds.length} criterios`} de ${ref}` : ref;
    })
    .join(", ");

  const submit = () => {
    if (!items || !chosen) return;
    implement(items, { agent: chosen, cwd, permission, model, instructions }, () => (onLaunched?.(), close()));
  };

  return (
    <dialog
      ref={ref}
      onClose={close}
      onClick={(e) => e.target === ref.current && close()}
      aria-labelledby="launch-agent-title"
      className="m-auto max-h-[90dvh] w-[min(calc(100vw-2rem),720px)] overflow-hidden rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      {items && (
        <div className="flex max-h-[90dvh] flex-col">
          <header className="border-b border-line px-5 py-3">
            <h2 id="launch-agent-title" className="text-lg font-semibold">
              Implementar {label}
            </h2>
            <p className="text-sm text-muted">
              El agente arranca sin su interfaz con {items.length > 1 ? "estas tareas, en este orden" : "esta tarea"}, lee el contexto, trabaja en una
              rama propia y reporta al terminar. Lo ves en vivo en el resumen del proyecto. Estas opciones quedan para el próximo «Implementar».
            </p>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-ink">Agente</legend>
              {agents.isSuccess && installed.length === 0 && <p className="text-sm text-warn">No hay ningún agente instalado en este equipo.</p>}
              <div role="radiogroup" aria-label="Agente" className="grid gap-2 sm:grid-cols-3">
                {installed.map((a) => (
                  <ChoiceCard
                    key={a.kind}
                    mode="radio"
                    title={a.label}
                    description={!a.mcp ? "Sin MCP: no podrá reportar" : a.mcpOutdated ? "Conexión vieja: conviene actualizarla" : "Conectado a Agent Tracking"}
                    selected={chosen === a.kind}
                    onSelect={() => setAgent(a.kind)}
                  />
                ))}
              </div>
            </fieldset>
            <SelectField
              label="Dónde trabaja"
              value={cwd}
              onChange={setCwd}
              options={[
                { value: "", label: "Checkout principal" },
                ...checkouts.filter((w) => !w.main).map((w) => ({ value: w.path, label: `Worktree ${w.branch ?? "sin rama"} (${w.path})` })),
              ]}
            />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-ink">Permisos</legend>
              <div role="radiogroup" aria-label="Permisos" className="grid gap-2 sm:grid-cols-2">
                <ChoiceCard
                  mode="radio"
                  title="Seguro (recomendado)"
                  description="Edita archivos y ejecuta lo que permite la protección del propio agente; lo demás lo rechaza sin preguntar."
                  selected={permission === "safe"}
                  onSelect={() => setPermission("safe")}
                />
                <ChoiceCard
                  mode="radio"
                  title="Sin preguntas"
                  description="Ejecuta cualquier comando sin pedir permiso ni sandbox. Solo en repositorios donde confíes plenamente en el agente."
                  selected={permission === "full"}
                  onSelect={() => setPermission("full")}
                />
              </div>
              {permission === "full" && (
                <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
                  Sin preguntas, el agente puede borrar archivos, instalar paquetes o usar la red sin avisarte. Agent Tracking sigue bloqueando los
                  comandos de git que dañan main si sus hooks están conectados.
                </p>
              )}
            </fieldset>
            <TextField label="Modelo (opcional)" value={model} onChange={setModel} placeholder="El del agente" spellCheck={false} autoComplete="off" />
            <TextAreaField label="Indicaciones adicionales (opcional)" value={instructions} onChange={setInstructions} rows={3} />
          </div>
          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-3">
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={!chosen} isLoading={isLaunching} onClick={submit}>
              Lanzar agente
            </Button>
          </footer>
        </div>
      )}
    </dialog>
  );
};

export default LaunchAgentDialog;
