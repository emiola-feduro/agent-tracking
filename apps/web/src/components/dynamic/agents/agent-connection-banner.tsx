import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Button from "@/components/ui/button/button";
import { api, type AgentInfo } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import AgentPlanDialog from "./agent-plan-dialog";

const DISMISS_KEY = "agent-tracking:connection-banner-dismissed";
const readDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * Warns, on every page, when an installed agent reaches Agent Tracking through an old connection: an
 * MCP that runs as a local process (it keeps the code it started with after an update) or hooks from
 * an older version. One button opens the exact change to apply; afterwards the open sessions of that
 * agent need one restart.
 */
const AgentConnectionBanner = () => {
  const agents = useQuery({ queryKey: queryKeys.agents, queryFn: api.agents, refetchInterval: 60_000 });
  const [dismissed, setDismissed] = useState(readDismissed);
  const [updating, setUpdating] = useState<AgentInfo | null>(null);
  const [updated, setUpdated] = useState<AgentInfo | null>(null);
  const outdated = (agents.data ?? []).filter((a) => a.installed && (a.mcpOutdated || a.hooksOutdated));

  const dismiss = () => {
    setDismissed(true);
    setUpdated(null);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Without storage it just comes back on the next load.
    }
  };

  if (!updated && (dismissed || outdated.length === 0)) return <AgentPlanDialog agent={updating} action="connect" onClose={() => setUpdating(null)} onApplied={setUpdated} />;

  return (
    <>
      <div role="status" className="border-b border-warn/30 bg-warn-soft">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm">
          {updated ? (
            <p className="min-w-0 flex-1 text-ink">
              Conexión de {updated.label} actualizada. Reinicia una vez las sesiones de {updated.label} que tengas abiertas (o usa /mcp para reconectar);
              desde ahí no hará falta tras cada actualización.
            </p>
          ) : (
            <>
              <p className="min-w-0 flex-1 text-ink">
                {outdated.map((a) => a.label).join(" y ")} {outdated.length === 1 ? "usa" : "usan"} una conexión vieja con Agent Tracking: su MCP se
                queda con el código anterior tras cada actualización y hay que reconectarlo a mano.
              </p>
              <div className="flex flex-wrap gap-2">
                {outdated.map((a) => (
                  <Button key={a.kind} size="sm" variant="primary" onClick={() => setUpdating(a)}>
                    Actualizar {outdated.length > 1 ? a.label : "conexión"}
                  </Button>
                ))}
              </div>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={dismiss}>
            {updated ? "Entendido" : "Ahora no"}
          </Button>
        </div>
      </div>
      <AgentPlanDialog agent={updating} action="connect" onClose={() => setUpdating(null)} onApplied={setUpdated} />
    </>
  );
};

export default AgentConnectionBanner;
