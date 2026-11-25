import Button from "@/components/ui/button/button";
import Segmented from "@/components/ui/segmented/segmented";
import SuggestInput from "@/components/ui/suggest-input/suggest-input";
import useTraceSuggestions from "@/hooks/ui/use-trace-suggestions";
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


const ProjectDetailTraceability = ({ view }: { view: ProjectView }) => {
  const { requirements, features, progress } = view;
  const trace = useTraceability(view);
  const { pendingFiles, unlinkedFiles, symbolsOf, allFiles } = trace;
  const [mode, setMode] = useState<Mode>("requirements");
  const [query, setQuery] = useState("");
  const suggestions = useTraceSuggestions(view, query);
  // Features, folders and files all start folded; searching opens what matches.
  const expanded = useExpanded();

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
  const folderKeys = [...new Set(shownFiles.map((f) => `folder:${f.path.slice(0, f.path.lastIndexOf("/") + 1)}`))];
  const groupKeys = mode === "files" ? folderKeys : features.map((f) => `feature:${f.id}`);
  const allOpen = groupKeys.length > 0 && groupKeys.every((k) => expanded.isOpen(k));

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
            <SuggestInput
              label="Buscar archivo o símbolo"
              value={query}
              onChange={setQuery}
              suggestions={suggestions}
              emptyTitle="Para empezar"
              placeholder="Escribe o elige: app.ts, createApp..."
              className="sm:w-80"
            />
            <Button
              variant="secondary"
              disabled={shownFiles.length === 0}
              onClick={() => expanded.setAll(allOpen ? [] : [...groupKeys, ...shownFiles.map((f) => f.id)])}
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
            <ProjectDetailTraceByFile files={shownFiles} trace={trace} expanded={expanded} forceOpen={searching} />
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
                forceOpen={searching}
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
