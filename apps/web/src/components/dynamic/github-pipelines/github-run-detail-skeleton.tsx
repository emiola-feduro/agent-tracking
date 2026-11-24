import Skeleton from "@/components/ui/skeleton/skeleton";

const GithubRunDetailSkeleton = () => {
  return (
    <div aria-busy="true" aria-label="Cargando jobs" className="flex flex-col gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      ))}
    </div>
  );
};

export default GithubRunDetailSkeleton;
