import type { Feature, Requirement } from "@agent-tracking/core";
import ProgressBar from "@/components/ui/progress-bar/progress-bar";
import type { Traceability } from "@/hooks/data/use-traceability";
import type { Expanded } from "@/hooks/ui/use-expanded";
import type { FileArtifact, ProjectView } from "@/lib/api";
import ProjectDetailTraceFeature from "./project-detail-trace-feature";

type ProjectDetailTraceRequirementProps = {
  requirement: Requirement;
  features: Feature[];
  progress: ProjectView["progress"];
  trace: Traceability;
  /** Files of a feature after the search filter. */
  visibleFiles: (featureId: string) => FileArtifact[];
  expanded: Expanded;
  forceOpen?: boolean;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const ProjectDetailTraceRequirement = ({
  requirement,
  features,
  progress,
  trace,
  visibleFiles,
  expanded,
  forceOpen,
}: ProjectDetailTraceRequirementProps) => {
  const { id, title } = requirement;
  const files = features.flatMap((f) => trace.filesOf(f.id));
  const symbols = files.reduce((n, f) => n + trace.symbolsOf(f.id).length, 0);

  return (
    <article className="flex animate-enter flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:p-5">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-lg font-semibold text-ink">
            <span className="mr-2 text-xs font-medium tracking-wide text-muted uppercase">Requerimiento</span>
            {title}
          </h2>
          <span className="text-sm text-muted">
            {plural(features.length, "feature", "features")}, {plural(files.length, "archivo", "archivos")},{" "}
            {plural(symbols, "símbolo", "símbolos")}
          </span>
        </div>
        <ProgressBar value={progress.requirements[id] ?? 0} label={`Avance de ${title}`} />
      </header>
      {features.length === 0 ? (
        <p className="text-sm text-muted">Ningún agente ha empezado un feature aquí.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {features.map((feature) => (
            <ProjectDetailTraceFeature
              key={feature.id}
              feature={feature}
              progress={progress.features[feature.id] ?? 0}
              files={visibleFiles(feature.id)}
              symbolsOf={trace.symbolsOf}
              expanded={expanded}
              forceOpen={forceOpen}
            />
          ))}
        </ul>
      )}
    </article>
  );
};

export default ProjectDetailTraceRequirement;
