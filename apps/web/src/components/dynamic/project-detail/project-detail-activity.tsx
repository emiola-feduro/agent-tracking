import useProjectActivity from "@/hooks/data/use-project-activity";
import ProjectDetailActivityError from "./project-detail-activity-error";
import ProjectDetailActivityItem from "./project-detail-activity-item";
import ProjectDetailActivitySkeleton from "./project-detail-activity-skeleton";

const ProjectDetailActivity = ({ projectId }: { projectId: string }) => {
  const { data, status, refetch } = useProjectActivity(projectId);

  if (status === "pending") return <ProjectDetailActivitySkeleton />;
  if (status === "error") return <ProjectDetailActivityError onRetry={() => refetch()} />;

  return (
    <section aria-label="Actividad de los agentes" className="rounded-lg border border-line bg-surface p-5">
      {data.length === 0 ? (
        <p className="text-muted">Sin actividad todavía. Conecta un agente por MCP para verla aquí en vivo.</p>
      ) : (
        <ol aria-live="polite" className="flex flex-col divide-y divide-line">
          {data.map((event) => (
            <ProjectDetailActivityItem key={event.id} event={event} />
          ))}
        </ol>
      )}
    </section>
  );
};

export default ProjectDetailActivity;
