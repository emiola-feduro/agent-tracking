import Skeleton from "@/components/ui/skeleton/skeleton";

const GithubPullDetailSkeleton = () => {
  return (
    <div aria-busy="true" aria-label="Cargando detalle" className="flex flex-col gap-4">
      <Skeleton className="h-4 w-56" />
      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default GithubPullDetailSkeleton;
