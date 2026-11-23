import type { Feature, Requirement } from "@agent-tracking/core";
import type useTraceability from "@/hooks/data/use-traceability";
import type { ProjectView } from "@/lib/api";
import ProjectDetailTraceFeature from "./project-detail-trace-feature";

type ProjectDetailTraceRequirementProps = {
  requirement: Requirement;
  features: Feature[];
  progress: ProjectView["progress"];
  trace: ReturnType<typeof useTraceability>;
};

const ProjectDetailTraceRequirement = ({ requirement, features, progress, trace }: ProjectDetailTraceRequirementProps) => {
  const { id, title } = requirement;
  const { filesOf, symbolsOf } = trace;

  return (
    <article className="flex animate-enter flex-col gap-3 rounded-lg border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <span className="tabular-nums text-muted">{progress.requirements[id] ?? 0}%</span>
      </div>
      {features.length === 0 && <p className="text-sm text-muted">Ningún agente ha empezado un feature aquí.</p>}
      <ul className="flex flex-col divide-y divide-line">
        {features.map((feature) => (
          <ProjectDetailTraceFeature
            key={feature.id}
            feature={feature}
            progress={progress.features[feature.id] ?? 0}
            files={filesOf(feature.id)}
            symbolsOf={symbolsOf}
          />
        ))}
      </ul>
    </article>
  );
};

export default ProjectDetailTraceRequirement;
