import Skeleton from "@/components/ui/skeleton/skeleton";

const AssistantSuggestionsSkeleton = ({ rows = 3 }: { rows?: number }) => {
  return (
    <div aria-busy="true" aria-label="Generando sugerencias" className="flex flex-col gap-2 rounded-md border border-line p-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`h-5 ${i % 2 ? "w-3/5" : "w-4/5"}`} />
      ))}
    </div>
  );
};

export default AssistantSuggestionsSkeleton;
