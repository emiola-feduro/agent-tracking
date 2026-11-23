import { useNavigate } from "@tanstack/react-router";
import PageHeader from "@/components/layout/page-header/page-header";
import ProjectDetail, { type ProjectTab } from "@/components/dynamic/project-detail/project-detail";
import ProjectDetailError from "@/components/dynamic/project-detail/project-detail-error";
import ProjectDetailSkeleton from "@/components/dynamic/project-detail/project-detail-skeleton";
import Button from "@/components/ui/button/button";
import Skeleton from "@/components/ui/skeleton/skeleton";
import useDeleteProject from "@/hooks/data/use-delete-project";
import useProject from "@/hooks/data/use-project";
import { ApiError } from "@/lib/api";

type ProjectPageProps = {
  projectId: string;
  tab: ProjectTab;
};

const ProjectPage = ({ projectId, tab }: ProjectPageProps) => {
  const { data, status, error, refetch } = useProject(projectId);
  const navigate = useNavigate();
  const deleteProject = useDeleteProject();

  const changeTab = (next: ProjectTab) =>
    navigate({ to: "/projects/$projectId", params: { projectId }, search: { tab: next }, replace: true });

  const remove = () => {
    if (!data) return;
    if (!confirm(`Eliminar el proyecto "${data.project.name}" de Agent Tracking. Los archivos del repositorio no se tocan.`)) return;
    deleteProject.mutate(projectId);
  };

  return (
    <>
      <PageHeader
        back={{ to: "/", label: "Proyectos" }}
        title={data ? data.project.name : <Skeleton className="h-8 w-64" />}
        actions={
          data && (
            <Button variant="danger" size="sm" isLoading={deleteProject.isPending} onClick={remove}>
              Eliminar proyecto
            </Button>
          )
        }
      />
      {status === "pending" && <ProjectDetailSkeleton />}
      {status === "error" && (
        <ProjectDetailError notFound={error instanceof ApiError && error.status === 404} onRetry={() => refetch()} />
      )}
      {status === "success" && <ProjectDetail view={data} tab={tab} onTabChange={changeTab} />}
    </>
  );
};

export default ProjectPage;
