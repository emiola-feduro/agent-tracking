import StatusPill from "@/components/ui/status-pill/status-pill";
import useLiveActivity from "@/hooks/data/use-live-activity";
import { isPending } from "@/hooks/data/use-traceability";
import useNow from "@/hooks/ui/use-now";
import { formatEventTime } from "@/lib/activity";
import type { ProjectView } from "@/lib/api";
import { agentLabel } from "@/lib/labels";
import { relativeTime } from "@/lib/relative-time";

/** Files saved this recently count as work in progress even without hooks (the repo watcher sees them). */
const RECENT_MS = 2 * 60_000;
const MAX_STEPS = 8;
const MAX_FILES = 8;

/**
 * Shown while agents work: each one's latest steps (from its hooks: Claude Code, Codex CLI, Gemini CLI)
 * and the files changed (repo watcher). It goes away once the turns end and the changes are reported.
 */
const ProjectDetailLive = ({ view }: { view: ProjectView }) => {
  const { data: live } = useLiveActivity(view.project.id);
  const now = useNow();

  const pending = view.files
    .filter(isPending)
    .sort((a, b) => (b.changedAt ?? "").localeCompare(a.changedAt ?? ""));
  const working = live?.status === "working";
  const recent = pending.some((f) => f.changedAt && now - Date.parse(f.changedAt) < RECENT_MS);
  if (!working && !recent) return null;

  const steps = working ? (live?.steps ?? []) : [];
  const [current, ...previous] = steps;
  const active = (live?.sessions ?? []).filter((s) => s.status === "working");
  // The server puts the most recent working session first: that one is shown above in full.
  const others = active.slice(1, 5);
  const names = [...new Set(active.map((s) => agentLabel(s.agent)))];
  const title = !working
    ? "Hay cambios en curso en el repositorio"
    : names.length > 1
      ? `${names.slice(0, -1).join(", ")} y ${names.at(-1)} están trabajando`
      : `${agentLabel(live?.agent)} está trabajando`;

  return (
    <section
      aria-live="polite"
      aria-label="Trabajo en curso"
      className="flex animate-enter flex-col gap-4 rounded-lg border border-brand/30 bg-brand-soft/40 p-5"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span aria-hidden className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
        </span>
        <h2 className="font-semibold text-ink">
          {title}
        </h2>
        {working && live?.startedAt && <StatusPill tone="brand">empezó {relativeTime(live.startedAt, now)}</StatusPill>}
      </div>

      {current && (
        <p className="flex flex-wrap items-baseline gap-x-2 text-ink">
          <span className="font-medium">{current.label}</span>
          {current.target && <code className="font-mono text-[0.8125rem] break-all">{current.target}</code>}
        </p>
      )}
      {working && !current && <p className="text-ink-soft">Leyendo tu pedido y preparando el trabajo.</p>}
      {others.length > 0 && (
        <ul aria-label="Otros agentes trabajando" className="flex flex-col gap-1 border-t border-brand/20 pt-3">
          {others.map((s) => (
            <li key={`${s.agent}-${s.sessionId}`} className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium text-ink">{agentLabel(s.agent)}</span>
              {s.steps[0] ? (
                <>
                  <span className="text-ink-soft">{s.steps[0].label}</span>
                  {s.steps[0].target && <code className="truncate font-mono text-[0.8125rem] text-ink">{s.steps[0].target}</code>}
                </>
              ) : (
                <span className="text-muted">preparando el trabajo</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {previous.length > 0 && (
          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="text-sm text-muted">Pasos anteriores</h3>
            <ol className="flex flex-col gap-1">
              {previous.slice(0, MAX_STEPS).map((step) => (
                <li key={`${step.at}-${step.tool}-${step.target}`} className="flex min-w-0 animate-enter items-baseline gap-2 text-sm">
                  <time dateTime={step.at} className="shrink-0 font-mono text-xs text-muted tabular-nums">
                    {formatEventTime(step.at)}
                  </time>
                  <span className="shrink-0 text-ink-soft">{step.label}</span>
                  {step.target && <code className="truncate font-mono text-[0.8125rem] text-ink">{step.target}</code>}
                </li>
              ))}
            </ol>
          </div>
        )}

        {pending.length > 0 && (
          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="text-sm text-muted">
              Archivos cambiados ({pending.length})
            </h3>
            <ul className="flex flex-col gap-1">
              {pending.slice(0, MAX_FILES).map(({ id, path, changedAt }) => (
                <li key={id} className="flex min-w-0 animate-enter items-baseline justify-between gap-3 text-sm">
                  <code className="truncate font-mono text-[0.8125rem] text-ink">{path}</code>
                  {changedAt && <span className="shrink-0 text-xs text-muted tabular-nums">{relativeTime(changedAt, now)}</span>}
                </li>
              ))}
            </ul>
            {pending.length > MAX_FILES && <p className="text-xs text-muted">y {pending.length - MAX_FILES} más en Trazabilidad</p>}
          </div>
        )}
      </div>

      <p className="text-sm text-muted">
        Cuando el agente envíe su reporte, todo queda ordenado por requerimiento, feature y archivo.
      </p>
    </section>
  );
};

export default ProjectDetailLive;
