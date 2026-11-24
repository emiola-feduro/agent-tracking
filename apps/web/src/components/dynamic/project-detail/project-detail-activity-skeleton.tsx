import Skeleton from "@/components/ui/skeleton/skeleton";

const ProjectDetailActivitySkeleton = () => {
  return (
    <div aria-busy="true" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      {["w-2/3", "w-1/2", "w-3/4", "w-2/5", "w-3/5"].map((width, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className={`h-4 ${width}`} />
        </div>
      ))}
    </div>
  );
};

export default ProjectDetailActivitySkeleton;
