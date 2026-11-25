import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import Button from "@/components/ui/button/button";
import Skeleton from "@/components/ui/skeleton/skeleton";
import { api, type AgentInfo, type ConfigChange } from "@/lib/api";
import { compact, lineDiff } from "@/lib/line-diff";
import { queryKeys } from "@/lib/query-keys";

type Props = { agent: AgentInfo | null; action: "connect" | "disconnect"; onClose: () => void };

const ROW = { same: "", add: "bg-ok/12", del: "bg-danger/12 line-through decoration-danger/40", gap: "text-muted" } as const;
const SIGN = { same: " ", add: "+", del: "-", gap: "" } as const;

const ChangeView = ({ change }: { change: ConfigChange }) => {
  if (change.type === "command") {
    return (
      <section className="flex flex-col gap-1.5">
        <p className="text-sm text-ink">{change.description}</p>
        <p className="text-xs text-muted">Se ejecuta este comando:</p>
        <pre className="overflow-x-auto rounded-md bg-subtle p-3 font-mono text-[0.8125rem] text-ink">{change.argv.join(" ")}</pre>
      </section>
    );
  }
  const rows = compact(lineDiff(change.before ?? "", change.after));
  return (
    <section className="flex flex-col gap-1.5">
      <p className="text-sm text-ink">{change.description}</p>
      <p className="text-xs text-muted">
        <code className="font-mono">{change.path}</code> {change.before === null ? "(se crea)" : "(se guarda una copia .bak)"}
      </p>
      <div className="max-h-72 overflow-auto rounded-md border border-line font-mono text-[0.8125rem] leading-6 [font-variant-ligatures:none]">
        {rows.map((r, i) => (
          <div key={i} className={`px-3 whitespace-pre ${ROW[r.kind]}`}>
            <span aria-hidden className={`mr-2 select-none ${r.kind === "add" ? "text-ok" : r.kind === "del" ? "text-danger" : "text-muted"}`}>
              {SIGN[r.kind]}
            </span>
            {r.text || "​"}
          </div>
        ))}
      </div>
    </section>
  );
};

/**
 * Shows exactly which files (and commands) connecting or disconnecting an agent touches, as a diff,
 * and applies that very plan only after the person confirms.
 */
const AgentPlanDialog = ({ agent, action, onClose }: Props) => {
  const ref = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const plan = useQuery({
    queryKey: ["agents", agent?.kind, action, "plan"],
    queryFn: () => api.agentPlan(agent!.kind, action),
    enabled: !!agent,
    staleTime: 0,
    gcTime: 0,
  });
  const apply = useMutation({
    mutationFn: () => api.applyAgentPlan(agent!.kind, action, plan.data!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents });
      onClose();
    },
  });

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (agent && !d.open) d.showModal();
    if (!agent && d.open) d.close();
  }, [agent]);

  const verb = action === "connect" ? "Conectar" : "Desconectar";

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="agent-plan-title"
      className="m-auto max-h-[90dvh] w-[min(calc(100vw-2rem),860px)] overflow-hidden rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      {agent && (
        <div className="flex max-h-[90dvh] flex-col">
          <header className="border-b border-line px-5 py-3">
            <h2 id="agent-plan-title" className="text-lg font-semibold">
              {verb} {agent.label}
            </h2>
            <p className="text-sm text-muted">
              {action === "connect"
                ? "Esto es exactamente lo que se va a cambiar en la configuración de tu agente. Nada se escribe hasta que confirmes."
                : "Se quita solo lo que agregó Agent Tracking; el resto de tu configuración queda igual."}
            </p>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
            {plan.isPending && <Skeleton className="h-40" />}
            {plan.isError && <p className="text-sm text-danger">{(plan.error as Error).message}</p>}
            {plan.data?.length === 0 && <p className="text-sm text-muted">No hay nada que cambiar: ya está {action === "connect" ? "conectado" : "desconectado"}.</p>}
            {plan.data?.map((change, i) => <ChangeView key={i} change={change} />)}
            {action === "connect" && agent.kind === "codex" && (
              <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">La primera vez, Codex te pide revisar y confiar en los hooks nuevos antes de usarlos.</p>
            )}
          </div>
          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-3">
            {apply.isError && <p className="mr-auto text-sm text-danger">{(apply.error as Error).message}</p>}
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant={action === "connect" ? "primary" : "danger"}
              disabled={!plan.data?.length}
              isLoading={apply.isPending}
              onClick={() => apply.mutate()}
            >
              {verb}
            </Button>
          </footer>
        </div>
      )}
    </dialog>
  );
};

export default AgentPlanDialog;
