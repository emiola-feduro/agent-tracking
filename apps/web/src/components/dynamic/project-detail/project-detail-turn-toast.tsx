import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAgentTurns } from "@/hooks/data/use-agent-turns";
import type { AgentTurn } from "@/lib/api";

const RECENT_MS = 10 * 60_000;

/**
 * Says so as soon as the agent finishes a piece of work that changed the repository, from any
 * section, with a link to its summary. Turns that were already there when the page opened are not
 * announced.
 */
const ProjectDetailTurnToast = ({ projectId, onOverview }: { projectId: string; onOverview: boolean }) => {
  const { data: turns } = useAgentTurns(projectId);
  const seen = useRef<string | null | undefined>(undefined);
  const [shown, setShown] = useState<AgentTurn | null>(null);

  useEffect(() => {
    if (!turns) return;
    const latest = turns.find((t) => t.endedAt && t.files.length > 0) ?? null;
    if (seen.current === undefined) {
      seen.current = latest?.id ?? null;
      return;
    }
    if (latest && latest.id !== seen.current && Date.now() - Date.parse(latest.endedAt!) < RECENT_MS) {
      seen.current = latest.id;
      setShown(latest);
    }
  }, [turns]);

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), 30_000);
    return () => clearTimeout(timer);
  }, [shown]);

  if (!shown) return null;
  const added = shown.files.reduce((n, f) => n + f.insertions, 0);
  const removed = shown.files.reduce((n, f) => n + f.deletions, 0);

  // Rendered on the body: an animated ancestor would otherwise pin it to the page instead of the screen.
  return createPortal(
    <div role="status" className="fixed right-4 bottom-4 z-40 w-[min(calc(100vw-2rem),24rem)] animate-enter rounded-lg border border-brand/40 bg-surface p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-semibold text-ink">El agente terminó un trabajo</p>
          <p className="text-sm text-ink-soft">
            {shown.files.length === 1 ? "1 archivo" : `${shown.files.length} archivos`}{" "}
            <span className="font-mono text-xs">
              <span className="text-ok">+{added}</span> <span className="text-danger">-{removed}</span>
            </span>
            {shown.branch && (
              <>
                {" "}
                en <code className="font-mono text-xs">{shown.branch}</code>
              </>
            )}
          </p>
          {shown.prompt && <p className="line-clamp-2 text-sm text-muted">“{shown.prompt}”</p>}
        </div>
        <button type="button" aria-label="Cerrar aviso" onClick={() => setShown(null)} className="rounded-sm p-1 text-muted hover:text-ink">
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      {!onOverview && (
        <Link
          to="/projects/$projectId"
          params={{ projectId }}
          search={{ tab: "overview" }}
          onClick={() => setShown(null)}
          className="mt-3 inline-flex min-h-8 items-center rounded-md bg-brand px-3 text-sm font-medium text-on-brand hover:bg-brand-hover"
        >
          Ver el resumen
        </Link>
      )}
    </div>,
    document.body,
  );
};

export default ProjectDetailTurnToast;
