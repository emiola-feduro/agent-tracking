import Skeleton from "@/components/ui/skeleton/skeleton";

const NewProjectSkillsSkeleton = () => {
  return (
    <div aria-busy="true" aria-label="Buscando skills instaladas" className="flex flex-col gap-3">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-10 w-full" />
      <div className="flex flex-col gap-3 rounded-md border border-line p-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-4" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3.5 w-full max-w-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewProjectSkillsSkeleton;
