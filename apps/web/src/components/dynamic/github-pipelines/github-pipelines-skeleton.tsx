import Skeleton from "@/components/ui/skeleton/skeleton";

const GithubPipelinesSkeleton = () => {
  return (
    <ul aria-busy="true" aria-label="Cargando ejecuciones" className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="flex flex-col gap-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-2/5" />
        </li>
      ))}
    </ul>
  );
};

export default GithubPipelinesSkeleton;
