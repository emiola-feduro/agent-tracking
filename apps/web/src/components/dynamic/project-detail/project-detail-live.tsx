import StatusPill from "@/components/ui/status-pill/status-pill";
import useLiveActivity from "@/hooks/data/use-live-activity";
import { isPending } from "@/hooks/data/use-traceability";
import useNow from "@/hooks/ui/use-now";
import { formatEventTime } from "@/lib/activity";
import type { ProjectView } from "@/lib/api";
import { relativeTime } from "@/lib/relative-time";

/** Files saved this recently count as work in progress even without hooks (the repo watcher sees them). */
const RECENT_MS = 2 * 60_000;
const MAX_STEPS = 8;
const MAX_FILES = 8;

/**
 * Shown above the tabs while an agent works: its latest steps (Claude Code hooks) and the files it
 * has changed (repo watcher). It goes away once the turn ends and the changes are reported.
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
          {working ? "El agente está trabajando" : "Hay cambios en curso en el repositorio"}
        </h2>
        {working && live?.startedAt && <StatusPill tone="brand">empezó {relativeTime(live.startedAt, now)}</StatusPill>}
      </div>

      {current && (
        <p className="flex flex-wrap items-baseline gap-x-2 text-ink">
          <span className="font-medium">{current.label}</span>
          {current.target && <code className="font-mono text-[13px] break-all">{current.target}</code>}
        </p>
      )}
      {working && !current && <p className="text-ink-soft">Leyendo tu pedido y preparando el trabajo.</p>}

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
                  {step.target && <code className="truncate font-mono text-[13px] text-ink">{step.target}</code>}
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
                  <code className="truncate font-mono text-[13px] text-ink">{path}</code>
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
