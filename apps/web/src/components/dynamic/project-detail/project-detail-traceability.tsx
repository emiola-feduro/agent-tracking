import useTraceability from "@/hooks/data/use-traceability";
import type { ProjectView } from "@/lib/api";
import ProjectDetailPending from "./project-detail-pending";
import ProjectDetailTraceFile from "./project-detail-trace-file";
import ProjectDetailTraceRequirement from "./project-detail-trace-requirement";

const ProjectDetailTraceability = ({ view }: { view: ProjectView }) => {
  const { requirements, features, progress } = view;
  const trace = useTraceability(view);
  const { pendingFiles, unlinkedFiles, symbolsOf } = trace;

  return (
    <div className="flex flex-col gap-4">
      {pendingFiles.length > 0 && <ProjectDetailPending files={pendingFiles} symbolsOf={symbolsOf} />}
      {requirements.length === 0 && <p className="text-muted">Este proyecto aún no tiene requerimientos.</p>}
      {requirements.map((requirement) => (
        <ProjectDetailTraceRequirement
          key={requirement.id}
          requirement={requirement}
          features={features.filter((f) => f.requirementId === requirement.id)}
          progress={progress}
          trace={trace}
        />
      ))}
      {unlinkedFiles.length > 0 && (
        <section className="flex animate-enter flex-col gap-3 rounded-lg border border-line bg-surface p-5">
          <h2 className="font-semibold text-ink">Código sin feature</h2>
          <ul className="flex flex-col gap-3">
            {unlinkedFiles.map((file) => (
              <ProjectDetailTraceFile key={file.id} file={file} symbols={symbolsOf(file.id)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default ProjectDetailTraceability;
