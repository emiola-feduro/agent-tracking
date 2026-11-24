import Button from "@/components/ui/button/button";
import Segmented from "@/components/ui/segmented/segmented";
import TextField from "@/components/ui/text-field/text-field";
import useTraceability, { fileMatches } from "@/hooks/data/use-traceability";
import useExpanded from "@/hooks/ui/use-expanded";
import type { ProjectView } from "@/lib/api";
import { useState } from "react";
import ProjectDetailPending from "./project-detail-pending";
import ProjectDetailTraceByFile from "./project-detail-trace-by-file";
import ProjectDetailTraceFile from "./project-detail-trace-file";
import ProjectDetailTraceRequirement from "./project-detail-trace-requirement";
import { TraceContext } from "./trace-context";

type Mode = "requirements" | "files";

/** Small trees start open; bigger ones start as a list of files to scan. */
const OPEN_BY_DEFAULT = 4;

const ProjectDetailTraceability = ({ view }: { view: ProjectView }) => {
  const { requirements, features, progress } = view;
  const trace = useTraceability(view);
  const { pendingFiles, unlinkedFiles, symbolsOf, allFiles } = trace;
  const [mode, setMode] = useState<Mode>("requirements");
  const [query, setQuery] = useState("");
  const expanded = useExpanded(allFiles.length <= OPEN_BY_DEFAULT ? allFiles.map((f) => f.id) : []);

  const matches = (fileId: string) => {
    const file = allFiles.find((f) => f.id === fileId);
    return !!file && fileMatches(file, symbolsOf(fileId), query);
  };
  const visibleFiles = (featureId: string) => trace.filesOf(featureId).filter((f) => matches(f.id));
  const searching = query.trim() !== "";
  const shownRequirements = requirements.filter(
    (r) => !searching || features.some((f) => f.requirementId === r.id && visibleFiles(f.id).length > 0),
  );
  const shownFiles = allFiles.filter((f) => matches(f.id));
  const shownUnlinked = unlinkedFiles.filter((f) => matches(f.id));
  const allOpen = shownFiles.length > 0 && shownFiles.every((f) => expanded.isOpen(f.id));

  return (
    <TraceContext.Provider value={{ projectId: view.project.id, canPreview: !!view.project.repoPath }}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3 sm:flex-row sm:items-end sm:justify-between sm:p-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Ver por</span>
            <Segmented
              label="Ver la trazabilidad por"
              value={mode}
              onChange={setMode}
              items={[
                { value: "requirements", label: "Requerimiento" },
                { value: "files", label: `Archivo (${allFiles.length})` },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <TextField
              label="Buscar archivo o símbolo"
              type="search"
              value={query}
              onChange={setQuery}
              placeholder="app.ts, createApp..."
              className="sm:w-72"
            />
            <Button
              variant="secondary"
              disabled={shownFiles.length === 0}
              onClick={() => expanded.setAll(allOpen ? [] : shownFiles.map((f) => f.id))}
            >
              {allOpen ? "Contraer todo" : "Expandir todo"}
            </Button>
          </div>
        </div>

        {searching && shownFiles.length === 0 && <p className="text-muted">Ningún archivo ni símbolo coincide con “{query.trim()}”.</p>}

        {mode === "files" ? (
          allFiles.length === 0 ? (
            <p className="text-muted">Todavía no hay archivos reportados ni detectados.</p>
          ) : (
            <ProjectDetailTraceByFile files={shownFiles} trace={trace} expanded={expanded} />
          )
        ) : (
          <>
            {pendingFiles.length > 0 && !searching && <ProjectDetailPending files={pendingFiles} symbolsOf={symbolsOf} />}
            {requirements.length === 0 && <p className="text-muted">Este proyecto aún no tiene requerimientos.</p>}
            {shownRequirements.map((requirement) => (
              <ProjectDetailTraceRequirement
                key={requirement.id}
                requirement={requirement}
                features={features.filter((f) => f.requirementId === requirement.id && (!searching || visibleFiles(f.id).length > 0))}
                progress={progress}
                trace={trace}
                visibleFiles={visibleFiles}
                expanded={expanded}
              />
            ))}
            {shownUnlinked.length > 0 && (
              <section className="flex animate-enter flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:p-5">
                <header>
                  <h2 className="font-semibold text-ink">Código sin feature</h2>
                  <p className="text-sm text-muted">Archivos que ningún feature reclama todavía.</p>
                </header>
                <ul className="flex flex-col gap-2">
                  {shownUnlinked.map((file) => (
                    <ProjectDetailTraceFile
                      key={file.id}
                      file={file}
                      symbols={symbolsOf(file.id)}
                      open={expanded.isOpen(file.id)}
                      onToggle={() => expanded.toggle(file.id)}
                    />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </TraceContext.Provider>
  );
};

export default ProjectDetailTraceability;
