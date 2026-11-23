import Skeleton from "@/components/ui/skeleton/skeleton";

const ProjectDetailSkeleton = () => {
  return (
    <div aria-busy="true" aria-label="Cargando proyecto" className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
        <Skeleton className="h-2.5 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="contents">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-56" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-3 border-b border-line pb-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-5 w-28" />
        ))}
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-1.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
      ))}
    </div>
  );
};

export default ProjectDetailSkeleton;
