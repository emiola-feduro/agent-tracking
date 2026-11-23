import AssistantSetupNote from "@/components/dynamic/assistant/assistant-setup-note";
import type { ProjectView } from "@/lib/api";
import ProjectDetailRequirementCard from "./project-detail-requirement-card";
import ProjectDetailRequirementForm from "./project-detail-requirement-form";

const ProjectDetailRequirements = ({ view }: { view: ProjectView }) => {
  const { project, requirements } = view;

  return (
    <div className="flex flex-col gap-4">
      {requirements.length > 0 && <AssistantSetupNote />}
      {requirements.length === 0 && <p className="text-muted">Este proyecto aún no tiene requerimientos.</p>}
      {requirements.map((requirement) => (
        <ProjectDetailRequirementCard key={requirement.id} requirement={requirement} view={view} />
      ))}
      <ProjectDetailRequirementForm projectId={project.id} />
    </div>
  );
};

export default ProjectDetailRequirements;
