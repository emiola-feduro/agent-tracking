import type { CodeSymbol, Feature, FileArtifact } from "@/lib/api";
import StatusPill from "@/components/ui/status-pill/status-pill";
import { FEATURE_STATUS_LABEL, FEATURE_STATUS_TONE } from "@/lib/labels";
import ProjectDetailTraceFile from "./project-detail-trace-file";

type ProjectDetailTraceFeatureProps = {
  feature: Feature;
  progress: number;
  files: FileArtifact[];
  symbolsOf: (fileId: string) => CodeSymbol[];
};

const ProjectDetailTraceFeature = ({ feature, progress, files, symbolsOf }: ProjectDetailTraceFeatureProps) => {
  const { name, status, agent } = feature;

  return (
    <li className="flex animate-enter flex-col gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">{name}</span>
          <StatusPill tone={FEATURE_STATUS_TONE[status]}>{FEATURE_STATUS_LABEL[status]}</StatusPill>
          {agent && <span className="text-sm text-muted">{agent}</span>}
        </span>
        <span className="text-sm tabular-nums text-muted">{progress}%</span>
      </div>
      {files.length === 0 ? (
        <p className="text-sm text-muted">Sin archivos reportados.</p>
      ) : (
        <ul className="ml-1 flex flex-col gap-3 border-l border-line pl-4">
          {files.map((file) => (
            <ProjectDetailTraceFile key={file.id} file={file} symbols={symbolsOf(file.id)} />
          ))}
        </ul>
      )}
    </li>
  );
};

export default ProjectDetailTraceFeature;
