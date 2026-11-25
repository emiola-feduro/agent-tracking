import { classifyRequirement, FUNCTIONAL_AREAS, QUALITY_AREAS, REQUIREMENT_AREA_LABEL, REQUIREMENT_TYPE_HINT } from "@agent-tracking/core";
import { useMemo, useState } from "react";
import AssistantSetupNote from "@/components/dynamic/assistant/assistant-setup-note";
import RequirementsImportDialog from "@/components/dynamic/requirements-import/requirements-import-dialog";
import Button from "@/components/ui/button/button";
import Segmented from "@/components/ui/segmented/segmented";
import SuggestInput, { type Suggestion } from "@/components/ui/suggest-input/suggest-input";
import useProjectActions from "@/hooks/data/use-project-actions";
import useExpanded from "@/hooks/ui/use-expanded";
import type { ProjectView, RequirementArea, RequirementType } from "@/lib/api";
import { fuzzyScore } from "@/lib/fuzzy";
import ProjectDetailRequirementCard from "./project-detail-requirement-card";
import ProjectDetailRequirementForm from "./project-detail-requirement-form";

type TypeFilter = "all" | RequirementType;

const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Requirements split into functional and non functional, folded until opened, filterable and importable. */
const ProjectDetailRequirements = ({ view }: { view: ProjectView }) => {
  const { project, requirements, dod } = view;
  const kind = project.kind ?? "fullstack";
  const { importRequirements, updateRequirement } = useProjectActions(project.id);
  const [type, setType] = useState<TypeFilter>("all");
  const [areas, setAreas] = useState<RequirementArea[]>([]);
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const expanded = useExpanded();

  const criteriaOf = (id: string) => dod.filter((d) => d.requirementId === id);
  const q = normalize(query.trim());
  const matches = (r: ProjectView["requirements"][number]) =>
    (type === "all" || r.type === type) &&
    (areas.length === 0 || areas.includes(r.area)) &&
    (!q || normalize(`${r.title} ${r.description} ${criteriaOf(r.id).map((d) => d.criterion).join(" ")}`).includes(q));
  const shown = requirements.filter(matches);
  const count = (t: RequirementType) => requirements.filter((r) => r.type === t).length;
  const groups = (["functional", "non_functional"] as const)
    .map((t) => ({ type: t, items: shown.filter((r) => r.type === t) }))
    .filter((g) => g.items.length > 0);
  const filtering = type !== "all" || areas.length > 0 || q !== "";
  const allOpen = shown.length > 0 && shown.every((r) => expanded.isOpen(r.id));

  // Requirements still on the default classification whose text says otherwise.
  const misfiled = requirements
    .map((r) => ({ r, guess: classifyRequirement(r.title, r.description, kind) }))
    .filter(({ r, guess }) => r.area === "general" && (guess.type !== r.type || guess.area !== r.area));

  const suggestions: Suggestion[] = useMemo(() => {
    if (!query.trim()) {
      // Before typing: what still needs work.
      return requirements
        .map((r) => ({ r, left: criteriaOf(r.id).filter((d) => d.status !== "done").length }))
        .filter((x) => x.left > 0)
        .sort((a, b) => b.left - a.left)
        .slice(0, 6)
        .map(({ r, left }) => ({ value: r.title, kind: left === 1 ? "1 criterio pendiente" : `${left} criterios pendientes` }));
    }
    const out: (Suggestion & { score: number })[] = [];
    for (const r of requirements) {
      const s = fuzzyScore(query, r.title);
      if (s !== null) out.push({ value: r.title, kind: "Requerimiento", score: s + 5 });
      for (const d of criteriaOf(r.id)) {
        const c = fuzzyScore(query, d.criterion);
        if (c !== null && c >= 60) out.push({ value: d.criterion, kind: "Criterio", hint: r.title, score: c });
      }
    }
    return out.sort((a, b) => b.score - a.score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, requirements, dod]);

  const areaChips = (list: readonly RequirementArea[]) =>
    list
      .filter((a) => requirements.some((r) => r.area === a))
      .map((value) => {
        const on = areas.includes(value);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            onClick={() => setAreas((l) => (on ? l.filter((x) => x !== value) : [...l, value]))}
            className={`min-h-8 rounded-full border px-3 text-sm transition-colors duration-150 ${on ? "border-brand bg-brand-soft text-brand" : "border-line-strong text-ink-soft hover:bg-subtle"}`}
          >
            {REQUIREMENT_AREA_LABEL[value]} <span className="text-xs tabular-nums opacity-75">{requirements.filter((r) => r.area === value).length}</span>
          </button>
        );
      });

  return (
    <div className="flex flex-col gap-4">
      {requirements.length > 0 && <AssistantSetupNote />}
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Tipo</span>
            <Segmented<TypeFilter>
              label="Filtrar por tipo"
              value={type}
              onChange={setType}
              items={[
                { value: "all", label: `Todos (${requirements.length})` },
                { value: "functional", label: `Funcionales (${count("functional")})` },
                { value: "non_functional", label: `No funcionales (${count("non_functional")})` },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <SuggestInput
              label="Buscar requerimiento o criterio"
              value={query}
              onChange={setQuery}
              suggestions={suggestions}
              emptyTitle="Con criterios pendientes"
              placeholder="Escribe o elige"
              className="sm:w-72"
            />
            <Button onClick={() => setImporting(true)}>Importar</Button>
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted">
          <strong className="font-medium text-ink-soft">Funcional:</strong> {REQUIREMENT_TYPE_HINT.functional}{" "}
          <strong className="font-medium text-ink-soft">No funcional:</strong> {REQUIREMENT_TYPE_HINT.non_functional}
        </p>
        {requirements.length > 0 && (
          <div className="flex flex-col gap-2">
            {(type !== "non_functional" && areaChips(FUNCTIONAL_AREAS).length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs text-muted">Parte del sistema</span>
                {areaChips(FUNCTIONAL_AREAS)}
              </div>
            )}
            {(type !== "functional" && areaChips(QUALITY_AREAS).length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs text-muted">Atributo de calidad</span>
                {areaChips(QUALITY_AREAS)}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
          <Button size="sm" variant="ghost" disabled={shown.length === 0} onClick={() => expanded.setAll(allOpen ? [] : shown.map((r) => r.id))}>
            {allOpen ? "Contraer todo" : "Expandir todo"}
          </Button>
          {filtering && (
            <Button size="sm" variant="ghost" onClick={() => (setType("all"), setAreas([]), setQuery(""))}>
              Quitar filtros
            </Button>
          )}
          {misfiled.length > 0 && (
            <span className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              {misfiled.length === 1 ? "1 requerimiento parece mal clasificado." : `${misfiled.length} requerimientos parecen mal clasificados.`}
              <Button
                size="sm"
                isLoading={updateRequirement.isPending}
                onClick={() => misfiled.forEach(({ r, guess }) => updateRequirement.mutate({ reqId: r.id, type: guess.type, area: guess.area }))}
              >
                Clasificar según su texto
              </Button>
            </span>
          )}
        </div>
      </div>

      {requirements.length === 0 && <p className="text-muted">Este proyecto aún no tiene requerimientos. Agrégalos abajo o importa un archivo.</p>}
      {requirements.length > 0 && shown.length === 0 && <p className="text-muted">Ningún requerimiento coincide con estos filtros.</p>}
      {groups.map((group) => (
        <section key={group.type} aria-label={group.type === "functional" ? "Funcionales" : "No funcionales"} className="flex flex-col gap-2">
          <h2 className="flex items-baseline gap-2 pt-1 text-sm font-semibold tracking-wide text-muted uppercase">
            {group.type === "functional" ? "Funcionales" : "No funcionales"}
            <span className="font-normal normal-case tabular-nums">{group.items.length}</span>
          </h2>
          {group.items.map((requirement) => (
            <ProjectDetailRequirementCard
              key={requirement.id}
              requirement={requirement}
              view={view}
              open={expanded.isOpen(requirement.id)}
              onToggle={() => expanded.toggle(requirement.id)}
            />
          ))}
        </section>
      ))}
      <ProjectDetailRequirementForm projectId={project.id} kind={kind} />
      <RequirementsImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        kind={kind}
        busy={importRequirements.isPending}
        error={importRequirements.isError ? (importRequirements.error as Error).message : null}
        onImport={(text) => importRequirements.mutateAsync(text).then(() => setImporting(false))}
      />
    </div>
  );
};

export default ProjectDetailRequirements;
