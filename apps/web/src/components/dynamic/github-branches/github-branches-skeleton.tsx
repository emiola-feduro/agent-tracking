import Skeleton from "@/components/ui/skeleton/skeleton";

const GithubBranchesSkeleton = () => {
  return (
    <ul aria-busy="true" aria-label="Cargando ramas" className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="flex flex-col gap-2 px-4 py-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3.5 w-2/3" />
        </li>
      ))}
    </ul>
  );
};

export default GithubBranchesSkeleton;
