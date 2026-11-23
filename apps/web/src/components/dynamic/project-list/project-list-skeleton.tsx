import Skeleton from "@/components/ui/skeleton/skeleton";

const ProjectListSkeleton = () => {
  return (
    <ul aria-busy="true" aria-label="Cargando proyectos" className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
      {[0, 1, 2].map((i) => (
        <li key={i} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_220px] sm:items-center">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </div>
          <Skeleton className="h-2 w-full" />
        </li>
      ))}
    </ul>
  );
};

export default ProjectListSkeleton;
