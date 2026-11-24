import { isPending, type Traceability } from "@/hooks/data/use-traceability";
import type { Expanded } from "@/hooks/ui/use-expanded";
import type { FileArtifact } from "@/lib/api";
import ProjectDetailTraceFile from "./project-detail-trace-file";

type ProjectDetailTraceByFileProps = {
  files: FileArtifact[];
  trace: Traceability;
  expanded: Expanded;
};

const folderOf = (path: string) => {
  const at = path.lastIndexOf("/");
  return at >= 0 ? path.slice(0, at + 1) : "";
};

/** Every file the agent touched, grouped by folder, each with the requirement and feature it serves. */
const ProjectDetailTraceByFile = ({ files, trace, expanded }: ProjectDetailTraceByFileProps) => {
  const folders = new Map<string, FileArtifact[]>();
  for (const file of files) folders.set(folderOf(file.path), [...(folders.get(folderOf(file.path)) ?? []), file]);

  return (
    <div className="flex flex-col gap-5">
      {[...folders].map(([folder, list]) => (
        <section key={folder || "raiz"} aria-label={folder || "Raíz del repositorio"} className="flex flex-col gap-2">
          <h3 className="flex items-baseline gap-2 font-mono text-[0.8125rem] font-semibold text-ink-soft">
            {folder || "Raíz del repositorio"}
            <span className="font-sans text-xs font-normal text-muted">{list.length === 1 ? "1 archivo" : `${list.length} archivos`}</span>
          </h3>
          <ul className="flex flex-col gap-2">
            {list.map((file) => (
              <ProjectDetailTraceFile
                key={file.id}
                file={file}
                symbols={trace.symbolsOf(file.id)}
                links={trace.linksOf(file.id)}
                pending={isPending(file)}
                open={expanded.isOpen(file.id)}
                onToggle={() => expanded.toggle(file.id)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default ProjectDetailTraceByFile;
