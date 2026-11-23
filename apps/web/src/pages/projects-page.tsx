import { Link } from "@tanstack/react-router";
import PageHeader from "@/components/layout/page-header/page-header";
import ProjectList from "@/components/dynamic/project-list/project-list";
import ProjectListError from "@/components/dynamic/project-list/project-list-error";
import ProjectListSkeleton from "@/components/dynamic/project-list/project-list-skeleton";
import useProjects from "@/hooks/data/use-projects";

const ProjectsPage = () => {
  const { data, status, refetch } = useProjects();

  return (
    <>
      <PageHeader
        title="Proyectos"
        actions={
          <Link
            to="/projects/new"
            className="inline-flex min-h-10 items-center rounded-md bg-brand px-4 font-medium text-on-brand transition-colors hover:bg-brand-hover"
          >
            Nuevo proyecto
          </Link>
        }
      />
      {status === "pending" && <ProjectListSkeleton />}
      {status === "error" && <ProjectListError onRetry={() => refetch()} />}
      {status === "success" && <ProjectList projects={data} />}
    </>
  );
};

export default ProjectsPage;
