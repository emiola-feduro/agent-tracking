import type { Requirement } from "@agent-tracking/core";
import ProgressBar from "@/components/ui/progress-bar/progress-bar";
import RemoveButton from "@/components/ui/remove-button/remove-button";
import useProjectActions from "@/hooks/data/use-project-actions";
import type { ProjectView } from "@/lib/api";
import ProjectDetailDod from "./project-detail-dod";
import ProjectDetailFeatures from "./project-detail-features";

type ProjectDetailRequirementCardProps = {
  requirement: Requirement;
  view: ProjectView;
};

const ProjectDetailRequirementCard = ({ requirement, view }: ProjectDetailRequirementCardProps) => {
  const { id, title, description } = requirement;
  const { project, progress, dod, features } = view;
  const { deleteRequirement } = useProjectActions(project.id);

  const remove = () => {
    if (confirm(`Eliminar el requerimiento "${title}" y su Definition of Done. No se puede deshacer.`)) {
      deleteRequirement.mutate(id);
    }
  };

  return (
    <article className="flex animate-enter flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <RemoveButton label={`Eliminar ${title}`} onClick={remove} />
      </div>
      {description && <p className="-mt-2 max-w-[70ch] text-ink-soft">{description}</p>}
      <ProgressBar value={progress.requirements[id] ?? 0} label={`Avance de ${title}`} />
      <div className="grid gap-6 md:grid-cols-2">
        <ProjectDetailDod projectId={project.id} requirementId={id} items={dod.filter((d) => d.requirementId === id)} />
        <ProjectDetailFeatures
          features={features.filter((f) => f.requirementId === id)}
          progress={progress.features}
        />
      </div>
    </article>
  );
};

export default ProjectDetailRequirementCard;
