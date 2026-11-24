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
};

const ProjectDetailTraceFeature = ({ feature, progress, files, symbolsOf, expanded }: ProjectDetailTraceFeatureProps) => {
  const { name, status, agent } = feature;

  return (
    <li className="flex animate-enter flex-col gap-3 rounded-lg border border-line bg-subtle/50 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-medium tracking-wide text-muted uppercase">Feature</span>
          <span className="font-semibold text-ink">{name}</span>
          <StatusPill tone={FEATURE_STATUS_TONE[status]}>{FEATURE_STATUS_LABEL[status]}</StatusPill>
          {agent && <span className="text-sm text-muted">por {agent}</span>}
        </div>
        <div className="w-full sm:w-40">
          <ProgressBar value={progress} label={`Avance de ${name}`} />
        </div>
      </div>
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
    </li>
  );
};

export default ProjectDetailTraceFeature;
