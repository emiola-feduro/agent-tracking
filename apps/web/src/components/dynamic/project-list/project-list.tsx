import type { ProjectListItem } from "@/lib/api";
import ProjectListEmpty from "./project-list-empty";
import ProjectListRow from "./project-list-row";

const ProjectList = ({ projects }: { projects: ProjectListItem[] }) => {
  if (projects.length === 0) return <ProjectListEmpty />;

  return (
    <ul className="flex animate-enter flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {projects.map((project) => (
        <ProjectListRow key={project.id} project={project} />
      ))}
    </ul>
  );
};

export default ProjectList;
