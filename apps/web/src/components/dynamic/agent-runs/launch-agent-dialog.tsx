import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button/button";
import ChoiceCard from "@/components/ui/choice-card/choice-card";
import SelectField from "@/components/ui/select-field/select-field";
import TextAreaField from "@/components/ui/text-area-field/text-area-field";
import TextField from "@/components/ui/text-field/text-field";
import useImplement from "@/hooks/data/use-implement";
import { dodImplementable, slugify } from "@agent-tracking/core";
import CheckOption from "@/components/ui/check-option/check-option";
import { api, type AgentKind, type LaunchBranch, type LaunchPermission, type ProjectView } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import useImplementStore, { readLaunchDefaults } from "@/stores/use-implement-store";

const OTHER = "__other";

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
  const [otherModel, setOtherModel] = useState(false);
  const [branchMode, setBranchMode] = useState<LaunchBranch["mode"]>("new");
  const [branchName, setBranchName] = useState("");
  const [existingBranch, setExistingBranch] = useState("");
  /** Criteria chosen per requirement (the pending ones, all of them at first). */
  const [chosenDod, setChosenDod] = useState<Record<string, string[]>>({});
  const branches = useQuery({ queryKey: [...queryKeys.worktrees(projectId), "branches"], queryFn: () => api.localBranches(projectId), enabled: !!items });
  const pendingOf = (requirementId: string) => view.dod.filter((d) => d.requirementId === requirementId && dodImplementable(d));
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
      setBranchMode("new");
      setExistingBranch("");
      // A sensible name for a single task: feat/rf3-pagos-con-tarjeta.
      const first = items.length === 1 ? view.requirements.find((r) => r.id === items[0]!.requirementId) : null;
      setBranchName(first ? `feat/${[first.code?.toLowerCase(), slugify(first.title)].filter(Boolean).join("-").slice(0, 60)}` : "feat/");
      setChosenDod(Object.fromEntries(items.map((i) => [i.requirementId, i.dodIds ?? pendingOf(i.requirementId).map((d) => d.id)])));
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

  // The tasks as finally chosen: a requirement stays whole while all its pending criteria are kept.
  const finalItems = (items ?? []).flatMap((i) => {
    const pending = pendingOf(i.requirementId);
    const kept = pending.filter((d) => chosenDod[i.requirementId]?.includes(d.id)).map((d) => d.id);
    if (!i.dodIds && kept.length === pending.length) return [{ requirementId: i.requirementId }];
    return kept.length ? [{ requirementId: i.requirementId, dodIds: kept }] : [];
  });
  const branch: LaunchBranch | null =
    branchMode === "new" ? { mode: "new" } : branchMode === "named" ? (branchName.trim() ? { mode: "named", name: branchName.trim() } : null) : existingBranch ? { mode: "existing", name: existingBranch } : null;
  const agentInfo = installed.find((a) => a.kind === chosen);
  const models = agentInfo?.models ?? [];
  const showOther = otherModel || (!!model && !models.some((m) => m.id === model));

  const submit = () => {
    if (!finalItems.length || !chosen || !branch) return;
    implement(finalItems, { agent: chosen, cwd, permission, model, instructions, branch }, () => (onLaunched?.(), close()));
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
            {items.some((i) => pendingOf(i.requirementId).length > 0) && (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-1 text-sm font-medium text-ink">Qué implementa</legend>
                {items.map((i) => {
                  const r = view.requirements.find((x) => x.id === i.requirementId);
                  const pending = pendingOf(i.requirementId);
                  const picked = chosenDod[i.requirementId] ?? [];
                  if (!r || pending.length === 0) return null;
                  return (
                    <div key={i.requirementId} className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-ink">
                        {r.code && <span className="mr-1.5 font-mono text-brand">{r.code}</span>}
                        {r.title}
                      </p>
                      {pending.map((d) => (
                        <CheckOption
                          key={d.id}
                          checked={picked.includes(d.id)}
                          onChange={() =>
                            setChosenDod((s) => ({ ...s, [i.requirementId]: picked.includes(d.id) ? picked.filter((x) => x !== d.id) : [...picked, d.id] }))
                          }
                          label={d.criterion}
                        />
                      ))}
                    </div>
                  );
                })}
                {finalItems.length === 0 && <p className="text-sm text-warn">Elige al menos un criterio.</p>}
              </fieldset>
            )}
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
                    onSelect={() => (setAgent(a.kind), setModel(""), setOtherModel(false))}
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
            <div className="flex flex-col gap-2">
              <SelectField
                label="Modelo"
                value={showOther ? OTHER : model}
                onChange={(v) => (v === OTHER ? (setOtherModel(true), setModel("")) : (setOtherModel(false), setModel(v)))}
                options={[
                  { value: "", label: `El que use ${agentInfo?.label ?? "el agente"} por defecto` },
                  ...models.map((m) => ({ value: m.id, label: `${m.id} (${m.note})` })),
                  { value: OTHER, label: "Otro modelo…" },
                ]}
              />
              {showOther && <TextField label="Nombre del modelo" value={model} onChange={setModel} spellCheck={false} autoComplete="off" />}
            </div>
            <div className="flex flex-col gap-2">
              <SelectField
                label="Rama"
                value={branchMode}
                onChange={(v) => setBranchMode(v as LaunchBranch["mode"])}
                options={[
                  { value: "new", label: "Una rama nueva que nombra el agente" },
                  { value: "named", label: "Una rama nueva con este nombre" },
                  { value: "existing", label: "Una rama que ya existe" },
                ]}
              />
              {branchMode === "named" && (
                <TextField label="Nombre de la rama nueva" value={branchName} onChange={setBranchName} spellCheck={false} autoComplete="off" placeholder="feat/rf3-pagos" />
              )}
              {branchMode === "existing" && (
                <SelectField
                  label="Rama existente"
                  value={existingBranch}
                  onChange={setExistingBranch}
                  options={[
                    { value: "", label: "Elige una rama" },
                    ...(branches.data?.branches ?? [])
                      .filter((b) => b.name !== "main" && b.name !== "master")
                      .map((b) => ({ value: b.name, label: b.current ? `${b.name} (la actual)` : b.name })),
                  ]}
                />
              )}
              <p className="text-xs text-muted">Nunca trabaja directo en main ni en master. Si la rama ya está abierta en un worktree, elige ese worktree arriba.</p>
            </div>
            <TextAreaField label="Indicaciones adicionales (opcional)" value={instructions} onChange={setInstructions} rows={3} />
          </div>
          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-3">
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={!chosen || !branch || finalItems.length === 0} isLoading={isLaunching} onClick={submit}>
              Lanzar agente
            </Button>
          </footer>
        </div>
      )}
    </dialog>
  );
};

export default LaunchAgentDialog;
