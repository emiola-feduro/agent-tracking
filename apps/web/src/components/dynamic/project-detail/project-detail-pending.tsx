import StatusPill from "@/components/ui/status-pill/status-pill";
import type { CodeSymbol, FileArtifact } from "@/lib/api";
import { formatRelative } from "@/lib/activity";

type ProjectDetailPendingProps = {
  files: FileArtifact[];
  symbolsOf: (fileId: string) => CodeSymbol[];
};

/**
 * The live layer: files the agent is changing right now. They move into the requirement and feature
 * tree once the agent sends its final report.
 */
const ProjectDetailPending = ({ files, symbolsOf }: ProjectDetailPendingProps) => {
  return (
    <section
      aria-live="polite"
      className="flex animate-enter flex-col gap-3 rounded-lg border border-dashed border-warn/50 bg-warn-soft/40 p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold text-ink">Cambios sin reportar</h2>
        <StatusPill tone="warn">{files.length === 1 ? "1 archivo" : `${files.length} archivos`}</StatusPill>
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {files.map((file) => {
          const { id, path, changedAt } = file;
          const names = symbolsOf(id).map((s) => s.name);
          return (
            <li key={id} className="flex animate-enter flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <code className="font-mono text-[0.8125rem] text-ink break-all">{path}</code>
                {changedAt && <span className="text-sm text-muted tabular-nums">{formatRelative(changedAt)}</span>}
              </div>
              {names.length > 0 && (
                <p className="font-mono text-[0.8125rem] text-ink-soft break-words">
                  {names.slice(0, 8).join(", ")}
                  {names.length > 8 && <span className="font-sans text-muted"> y {names.length - 8} más</span>}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default ProjectDetailPending;
