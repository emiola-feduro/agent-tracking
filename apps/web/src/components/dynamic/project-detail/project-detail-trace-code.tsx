import CodeView from "@/components/ui/code-view/code-view";
import Skeleton from "@/components/ui/skeleton/skeleton";
import useRepoFile from "@/hooks/data/use-repo-file";
import { useTraceContext } from "./trace-context";

type ProjectDetailTraceCodeProps = { path: string; highlight: { start: number; end: number } | null };

/** The file as it is now in the repository, with the selected function or type marked. */
const ProjectDetailTraceCode = ({ path, highlight }: ProjectDetailTraceCodeProps) => {
  const { projectId, worktree } = useTraceContext();
  const { data, isPending, isError, error } = useRepoFile(projectId, path, true, worktree);
  const ext = path.split(".").pop() ?? "";

  if (isPending)
    return (
      <div className="flex flex-col gap-2 p-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-4 w-3/4" />
        ))}
      </div>
    );
  if (isError) return <p className="px-4 py-3 text-sm text-muted">{(error as Error).message || "No se pudo leer el archivo."}</p>;
  if (data.binary) return <p className="px-4 py-3 text-sm text-muted">Es un archivo binario, no se puede mostrar.</p>;
  return (
    <>
      <CodeView code={data.content} language={ext} highlight={highlight} label={`Código de ${path}`} />
      {data.truncated && (
        <p className="border-t border-line px-4 py-2 text-xs text-muted">El archivo es muy grande: se muestra solo el principio.</p>
      )}
    </>
  );
};

export default ProjectDetailTraceCode;
