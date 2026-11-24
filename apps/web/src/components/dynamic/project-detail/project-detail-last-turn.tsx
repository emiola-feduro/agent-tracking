import { useState } from "react";
import Button from "@/components/ui/button/button";
import DiffView from "@/components/ui/diff-view/diff-view";
import MarkdownPreview from "@/components/ui/markdown-preview/markdown-preview";
import Skeleton from "@/components/ui/skeleton/skeleton";
import StatusPill from "@/components/ui/status-pill/status-pill";
import { useAgentTurn, useAgentTurns } from "@/hooks/data/use-agent-turns";
import useNow from "@/hooks/ui/use-now";
import { formatEventTime } from "@/lib/activity";
import { relativeTime } from "@/lib/relative-time";

const duration = (from: string, to: string) => {
  const minutes = Math.round((Date.parse(to) - Date.parse(from)) / 60_000);
  if (minutes < 1) return "menos de un minuto";
  if (minutes < 60) return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h${m ? ` ${m} min` : ""}`;
};

type Panel = "summary" | "diff" | "steps";

/**
 * What the agent did in its last turn, right after it finishes: the request, its own final summary,
 * when and how long, on which branch, and the diff of exactly what that turn changed.
 * Older turns are one click away.
 */
const ProjectDetailLastTurn = ({ projectId }: { projectId: string }) => {
  const { data: turns } = useAgentTurns(projectId);
  const finished = (turns ?? []).filter((t) => t.endedAt);
  const [index, setIndex] = useState(0);
  const [panel, setPanel] = useState<Panel>("summary");
  const turn = finished[Math.min(index, finished.length - 1)] ?? null;
  const detail = useAgentTurn(projectId, panel === "diff" ? (turn?.id ?? null) : null);
  const now = useNow();
  if (!turn) return null;

  const added = turn.files.reduce((n, f) => n + f.insertions, 0);
  const removed = turn.files.reduce((n, f) => n + f.deletions, 0);
  const latest = index === 0;

  return (
    <section aria-labelledby="last-turn-title" className="flex animate-enter flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="last-turn-title" className="font-semibold text-ink">
            {latest ? "Lo último que hizo el agente" : "Turno anterior del agente"}
          </h2>
          <p className="text-sm text-muted">
            Terminó {relativeTime(turn.endedAt!, now)}, a las {formatEventTime(turn.endedAt!)}. Trabajó {duration(turn.startedAt, turn.endedAt!)}
            {turn.branch ? (
              <>
                {" "}
                en la rama <code className="font-mono text-ink-soft">{turn.branch}</code>
              </>
            ) : null}
            .
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={index >= finished.length - 1} onClick={() => (setIndex(index + 1), setPanel("summary"))}>
            Anterior
          </Button>
          <span className="text-xs text-muted tabular-nums">
            {index + 1} de {finished.length}
          </span>
          <Button variant="ghost" size="sm" disabled={latest} onClick={() => (setIndex(index - 1), setPanel("summary"))}>
            Siguiente
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <StatusPill>{turn.steps.length === 1 ? "1 paso" : `${turn.steps.length} pasos`}</StatusPill>
        <StatusPill tone={turn.files.length ? "brand" : "neutral"}>
          {turn.files.length === 1 ? "1 archivo" : `${turn.files.length} archivos`}
        </StatusPill>
        {turn.files.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-2.5 py-0.5 font-mono text-xs tabular-nums">
            <span className="text-ok">+{added}</span>
            <span className="text-danger">-{removed}</span>
          </span>
        )}
      </div>

      {turn.prompt && (
        <blockquote className="border-l-2 border-brand pl-3 text-sm text-ink-soft">
          <span className="block text-xs font-medium text-muted">Pedido</span>
          <span className="line-clamp-3 whitespace-pre-line">{turn.prompt}</span>
        </blockquote>
      )}

      <div role="tablist" aria-label="Detalle del turno" className="flex gap-1 border-b border-line">
        {(
          [
            ["summary", "Resumen"],
            ["diff", `Cambios (${turn.files.length})`],
            ["steps", `Pasos (${turn.steps.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={panel === value}
            onClick={() => setPanel(value)}
            className={`-mb-px min-h-9 border-b-2 px-3 text-sm font-medium transition-colors duration-150 ${panel === value ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {panel === "summary" &&
          (turn.summary ? (
            <div className="max-h-96 overflow-y-auto pr-1">
              <MarkdownPreview source={turn.summary} />
            </div>
          ) : (
            <p className="text-sm text-muted">El agente no dejó un mensaje final en este turno.</p>
          ))}
        {panel === "diff" &&
          (detail.isPending ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
          ) : detail.isError ? (
            <p className="text-sm text-danger">{(detail.error as Error).message}</p>
          ) : (
            <DiffView patch={detail.data.patch} files={detail.data.files} truncated={detail.data.patchTruncated} />
          ))}
        {panel === "steps" &&
          (turn.steps.length === 0 ? (
            <p className="text-sm text-muted">No se registraron pasos.</p>
          ) : (
            <ol className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {turn.steps.map((step, i) => (
                <li key={`${step.at}-${i}`} className="flex min-w-0 items-baseline gap-2 text-sm">
                  <time dateTime={step.at} className="shrink-0 font-mono text-xs text-muted tabular-nums">
                    {formatEventTime(step.at)}
                  </time>
                  <span className="shrink-0 text-ink-soft">{step.label}</span>
                  {step.target && <code className="truncate font-mono text-[0.8125rem] text-ink">{step.target}</code>}
                </li>
              ))}
            </ol>
          ))}
      </div>
    </section>
  );
};

export default ProjectDetailLastTurn;
