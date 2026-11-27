import { useState } from "react";
import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import useAgentRuns from "@/hooks/data/use-agent-runs";
import type { IntegrateOutcome } from "@/hooks/data/use-integrate";
import { api } from "@/lib/api";
import { readLaunchDefaults } from "@/stores/use-implement-store";
import CommitDialog from "./commit-dialog";
import ConflictDialog from "./conflict-dialog";

type Props = {
  projectId: string;
  outcome: IntegrateOutcome;
  onClose: () => void;
  onChange: (outcome: IntegrateOutcome | null) => void;
  integrate: (branch: string, push: boolean) => void;
};

/**
 * The result of integrating, with what to do next when git stopped it: commit the uncommitted
 * changes, resolve the conflicts here or hand them to an agent, and integrate again.
 */
const IntegrateOutcomeView = ({ projectId, outcome, onClose, onChange, integrate }: Props) => {
  const [committing, setCommitting] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const { runs } = useAgentRuns(projectId);
  const [asking, setAsking] = useState(false);

  const askAgent = async () => {
    const defaults = readLaunchDefaults(projectId);
    const agents = await api.agents().catch(() => []);
    const agent = agents.find((a) => a.installed && a.kind === defaults.agent) ?? agents.find((a) => a.installed && a.kind === "claude-code") ?? agents.find((a) => a.installed);
    if (!agent) return onChange({ ...outcome, text: "No hay ningún agente instalado para resolverlo." });
    setAsking(true);
    try {
      const run = await api.resolveWithAgent(projectId, {
        branch: outcome.branch,
        agent: agent.kind,
        permission: defaults.permission,
        model: defaults.model.trim() || undefined,
        conflicts: outcome.conflicts ?? [],
      });
      void runs.refetch();
      onChange({
        branch: outcome.branch,
        tone: "info",
        text: `${agent.label} ${run.status === "queued" ? "resolverá los conflictos cuando termine lo que tiene en curso" : "está resolviendo los conflictos"} de ${outcome.branch}. Cuando termine, la rama aparecerá lista para integrar.`,
      });
    } catch (e) {
      onChange({ ...outcome, text: (e as Error).message });
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <Alert tone={outcome.tone}>{outcome.text}</Alert>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </div>
      {(outcome.code === "unmerged" || outcome.code === "dirty" || outcome.ready) && (
        <div className="flex flex-wrap gap-2">
          {outcome.code === "unmerged" && (
            <>
              <Button size="sm" variant="primary" onClick={() => setResolving(outcome.branch)}>
                Resolver aquí
              </Button>
              <Button size="sm" isLoading={asking} onClick={() => void askAgent()}>
                Resolver con un agente
              </Button>
            </>
          )}
          {outcome.code === "dirty" && (
            <Button size="sm" variant="primary" onClick={() => setCommitting(true)}>
              Hacer commit…
            </Button>
          )}
          {outcome.ready && (
            <>
              <Button size="sm" variant="ghost" onClick={() => integrate(outcome.branch, false)}>
                Solo integrar
              </Button>
              <Button size="sm" variant="primary" onClick={() => integrate(outcome.branch, true)}>
                Integrar y subir
              </Button>
            </>
          )}
        </div>
      )}
      <CommitDialog
        projectId={projectId}
        open={committing}
        worktree={outcome.path ?? null}
        where={outcome.path}
        onClose={() => setCommitting(false)}
        onDone={() => onChange({ branch: outcome.branch, tone: "info", text: "Commit hecho. Ya puedes integrar de nuevo.", ready: true })}
      />
      <ConflictDialog
        projectId={projectId}
        branch={resolving}
        onClose={() => setResolving(null)}
        onFinished={(branch) => {
          setResolving(null);
          onChange({ branch, tone: "info", text: `${branch} ya incluye los cambios de la rama principal y no tiene conflictos: ya se puede integrar.`, ready: true });
        }}
      />
    </div>
  );
};

export default IntegrateOutcomeView;
