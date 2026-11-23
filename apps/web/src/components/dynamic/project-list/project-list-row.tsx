import { Link } from "@tanstack/react-router";
import ProgressBar from "@/components/ui/progress-bar/progress-bar";
import type { ProjectListItem } from "@/lib/api";
import { platformList } from "@/lib/labels";

const ProjectListRow = ({ project }: { project: ProjectListItem }) => {
  const { id, name, goal, platforms, repoUrl, progress } = project;

  return (
    <li>
      <Link
        to="/projects/$projectId"
        params={{ projectId: id }}
        className="grid gap-3 px-5 py-4 transition-colors duration-150 hover:bg-subtle sm:grid-cols-[1fr_220px] sm:items-center"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-semibold text-ink">{name}</span>
            <span className="text-sm text-muted">{platformList(platforms)}</span>
          </div>
          <p className="truncate text-sm text-ink-soft">{goal || repoUrl || "Sin objetivo definido"}</p>
        </div>
        <ProgressBar value={progress} label={`Avance de ${name}`} />
      </Link>
    </li>
  );
};

export default ProjectListRow;
