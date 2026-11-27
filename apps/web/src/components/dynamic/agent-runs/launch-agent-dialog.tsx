import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button/button";
import ChoiceCard from "@/components/ui/choice-card/choice-card";
import SelectField from "@/components/ui/select-field/select-field";
import TextAreaField from "@/components/ui/text-area-field/text-area-field";
import TextField from "@/components/ui/text-field/text-field";
import useAgentRuns from "@/hooks/data/use-agent-runs";
import { api, type AgentKind, type LaunchPermission, type Requirement } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

type Props = { projectId: string; requirement: Requirement | null; onClose: () => void; onLaunched?: () => void };

/**
 * Starts a coding agent on one requirement: which agent (only the installed ones), where it works
 * (the main checkout or a worktree), with what permissions, and optional extra instructions.
 */
const LaunchAgentDialog = ({ projectId, requirement, onClose, onLaunched }: Props) => {
  const ref = useRef<HTMLDialogElement>(null);
  const agents = useQuery({ queryKey: queryKeys.agents, queryFn: api.agents, enabled: !!requirement });
  const worktrees = useQuery({ queryKey: queryKeys.worktrees(projectId), queryFn: () => api.worktrees(projectId), enabled: !!requirement });
  const { launch } = useAgentRuns(projectId);
  const installed = (agents.data ?? []).filter((a) => a.installed);
  const [agent, setAgent] = useState<AgentKind | null>(null);
  const [cwd, setCwd] = useState("");
  const [permission, setPermission] = useState<LaunchPermission>("safe");
  const [model, setModel] = useState("");
  const [instructions, setInstructions] = useState("");
  const chosen = agent ?? installed[0]?.kind ?? null;
  const checkouts = worktrees.data?.worktrees ?? [];

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (requirement && !d.open) {
      launch.reset();
      d.showModal();
    }
    if (!requirement && d.open) d.close();
  }, [requirement]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (!requirement || !chosen) return;
    launch.mutate(
      { requirementId: requirement.id, agent: chosen, cwd: cwd || undefined, permission, model: model.trim() || undefined, instructions: instructions.trim() || undefined },
      { onSuccess: () => (onLaunched?.(), onClose()) },
    );
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="launch-agent-title"
      className="m-auto max-h-[90dvh] w-[min(calc(100vw-2rem),720px)] overflow-hidden rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      {requirement && (
        <div className="flex max-h-[90dvh] flex-col">
          <header className="border-b border-line px-5 py-3">
            <h2 id="launch-agent-title" className="text-lg font-semibold">
              Implementar {requirement.code ? `${requirement.code} ` : ""}con un agente
            </h2>
            <p className="text-sm text-muted">
              El agente arranca sin su interfaz con este requerimiento, lee el contexto, trabaja en una rama propia y reporta al terminar. Lo ves en
              vivo en el resumen del proyecto.
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
            {launch.isError && <p className="mr-auto text-sm text-danger">{(launch.error as Error).message}</p>}
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={!chosen} isLoading={launch.isPending} onClick={submit}>
              Lanzar agente
            </Button>
          </footer>
        </div>
      )}
    </dialog>
  );
};

export default LaunchAgentDialog;
