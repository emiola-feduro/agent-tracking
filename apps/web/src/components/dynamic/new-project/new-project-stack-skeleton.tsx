import Skeleton from "@/components/ui/skeleton/skeleton";

const NewProjectStackSkeleton = () => {
  return (
    <div aria-busy="true" aria-label="Cargando opciones de stack" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-64" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
      <div className="grid gap-6 sm:grid-cols-3">
        {[0, 1, 2].map((col) => (
          <div key={col} className="flex flex-col gap-3">
            <Skeleton className="h-4 w-24" />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-5 w-32" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewProjectStackSkeleton;
