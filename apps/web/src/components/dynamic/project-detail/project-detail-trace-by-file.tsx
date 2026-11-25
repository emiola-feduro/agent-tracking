import { isPending, type Traceability } from "@/hooks/data/use-traceability";
import type { Expanded } from "@/hooks/ui/use-expanded";
import type { FileArtifact } from "@/lib/api";
import ProjectDetailTraceFile from "./project-detail-trace-file";

type ProjectDetailTraceByFileProps = {
  files: FileArtifact[];
  trace: Traceability;
  expanded: Expanded;
  /** While searching, every folder with matches is open. */
  forceOpen?: boolean;
};

const folderOf = (path: string) => {
  const at = path.lastIndexOf("/");
  return at >= 0 ? path.slice(0, at + 1) : "";
};

/** Every file the agent touched, grouped by folder, each with the requirement and feature it serves. */
const ProjectDetailTraceByFile = ({ files, trace, expanded, forceOpen = false }: ProjectDetailTraceByFileProps) => {
  const folders = new Map<string, FileArtifact[]>();
  for (const file of files) folders.set(folderOf(file.path), [...(folders.get(folderOf(file.path)) ?? []), file]);

  return (
    <div className="flex flex-col gap-5">
      {[...folders].map(([folder, list]) => {
        const key = `folder:${folder}`;
        const open = forceOpen || expanded.isOpen(key);
        const pending = list.filter(isPending).length;
        return (
          <section key={folder || "raiz"} aria-label={folder || "Raíz del repositorio"} className="flex flex-col gap-2">
            <h3>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => expanded.toggle(key)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-subtle"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 16 16"
                  className={`size-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="m6 4 4 4-4 4" />
                </svg>
                <span className="font-mono text-[0.8125rem] font-semibold text-ink-soft">{folder || "Raíz del repositorio"}</span>
                <span className="text-xs text-muted">{list.length === 1 ? "1 archivo" : `${list.length} archivos`}</span>
                {pending > 0 && <span className="text-xs text-warn">{pending} sin reportar</span>}
              </button>
            </h3>
            {open && (
              <ul className="flex animate-enter flex-col gap-2 pl-6">
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
            )}
          </section>
        );
      })}
    </div>
  );
};

export default ProjectDetailTraceByFile;
