import { useState } from "react";
import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import Skeleton from "@/components/ui/skeleton/skeleton";
import useProjectActions from "@/hooks/data/use-project-actions";
import useProjectContext from "@/hooks/data/use-project-context";
import type { ProjectView } from "@/lib/api";

const ProjectDetailContext = ({ view }: { view: ProjectView }) => {
  const { project } = view;
  const { id, repoPath } = project;
  const { data, status } = useProjectContext(id);
  const { writeRepoFiles } = useProjectActions(id);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <code className="font-mono text-sm text-ink-soft">.agent-tracking/CONTEXT.md</code>
        <div className="flex gap-2">
          <Button size="sm" onClick={copy} disabled={!data}>
            {copied ? "Copiado" : "Copiar"}
          </Button>
          {repoPath && (
            <Button size="sm" variant="primary" isLoading={writeRepoFiles.isPending} onClick={() => writeRepoFiles.mutate()}>
              Guardar en el repo
            </Button>
          )}
        </div>
      </div>
      {writeRepoFiles.isSuccess && <Alert tone="info">Guardado en {writeRepoFiles.data.path}</Alert>}
      {writeRepoFiles.isError && <Alert>{writeRepoFiles.error.message}</Alert>}
      {status === "pending" && (
        <div aria-busy="true" className="flex flex-col gap-2 rounded-md bg-subtle p-4">
          {["w-1/3", "w-full", "w-5/6", "w-2/3", "w-full", "w-1/2"].map((w, i) => (
            <Skeleton key={i} className={`h-3.5 bg-line ${w}`} />
          ))}
        </div>
      )}
      {status === "error" && <Alert>No se pudo generar el contexto.</Alert>}
      {status === "success" && (
        <pre className="max-h-[560px] animate-enter overflow-auto rounded-md bg-subtle p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
          {data}
        </pre>
      )}
    </section>
  );
};

export default ProjectDetailContext;
