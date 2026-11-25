import ProgressBar from "@/components/ui/progress-bar/progress-bar";
import StatusPill from "@/components/ui/status-pill/status-pill";
import type { CodeSymbol, Feature, FileArtifact } from "@/lib/api";
import type { Expanded } from "@/hooks/ui/use-expanded";
import { FEATURE_STATUS_LABEL, FEATURE_STATUS_TONE } from "@/lib/labels";
import ProjectDetailTraceFile from "./project-detail-trace-file";

type ProjectDetailTraceFeatureProps = {
  feature: Feature;
  progress: number;
  files: FileArtifact[];
  symbolsOf: (fileId: string) => CodeSymbol[];
  expanded: Expanded;
  /** While searching, every feature with matches is open. */
  forceOpen?: boolean;
};

const ProjectDetailTraceFeature = ({
  feature,
  progress,
  files,
  symbolsOf,
  expanded,
  forceOpen = false,
}: ProjectDetailTraceFeatureProps) => {
  const { id, name, status, agent } = feature;
  const key = `feature:${id}`;
  const open = forceOpen || expanded.isOpen(key);
  const panelId = `trace-feature-${id}`;

  return (
    <li className="flex animate-enter flex-col overflow-hidden rounded-lg border border-line bg-subtle/50">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => expanded.toggle(key)}
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3 text-left transition-colors duration-150 hover:bg-subtle sm:px-4"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className={`size-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="m6 4 4 4-4 4" />
          </svg>
          <span className="text-xs font-medium tracking-wide text-muted uppercase">Feature</span>
          <span className="font-semibold text-ink">{name}</span>
          <StatusPill tone={FEATURE_STATUS_TONE[status]}>{FEATURE_STATUS_LABEL[status]}</StatusPill>
          {agent && <span className="text-sm text-muted">por {agent}</span>}
          <span className="text-sm text-muted tabular-nums">{files.length === 1 ? "1 archivo" : `${files.length} archivos`}</span>
        </span>
        <span className="w-full sm:w-40">
          <ProgressBar value={progress} label={`Avance de ${name}`} />
        </span>
      </button>
      {open && (
        <div id={panelId} className="animate-enter px-3 pb-3 sm:px-4 sm:pb-4">
          {files.length === 0 ? (
            <p className="text-sm text-muted">Sin archivos reportados.</p>
          ) : (
            <ul aria-label={`Archivos de ${name}`} className="flex flex-col gap-2">
              {files.map((file) => (
                <ProjectDetailTraceFile
                  key={file.id}
                  file={file}
                  symbols={symbolsOf(file.id)}
                  open={expanded.isOpen(file.id)}
                  onToggle={() => expanded.toggle(file.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
};

export default ProjectDetailTraceFeature;
