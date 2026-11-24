import { useState } from "react";
import AssistantSetupNote from "@/components/dynamic/assistant/assistant-setup-note";
import Segmented from "@/components/ui/segmented/segmented";
import TextField from "@/components/ui/text-field/text-field";
import type { ProjectView, RequirementArea, RequirementType } from "@/lib/api";
import { REQUIREMENT_AREA_OPTIONS, REQUIREMENT_TYPE_LABEL } from "@/lib/labels";
import ProjectDetailRequirementCard from "./project-detail-requirement-card";
import ProjectDetailRequirementForm from "./project-detail-requirement-form";

type TypeFilter = "all" | RequirementType;

const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Requirements split into functional and non functional, filterable by type, area and text. */
const ProjectDetailRequirements = ({ view }: { view: ProjectView }) => {
  const { project, requirements } = view;
  const [type, setType] = useState<TypeFilter>("all");
  const [areas, setAreas] = useState<RequirementArea[]>([]);
  const [query, setQuery] = useState("");

  const q = normalize(query.trim());
  const matches = (r: ProjectView["requirements"][number]) =>
    (type === "all" || r.type === type) &&
    (areas.length === 0 || areas.includes(r.area)) &&
    (!q || normalize(`${r.title} ${r.description}`).includes(q));
  const shown = requirements.filter(matches);
  const count = (t: RequirementType) => requirements.filter((r) => r.type === t).length;
  const usedAreas = REQUIREMENT_AREA_OPTIONS.filter((o) => requirements.some((r) => r.area === o.value));
  const groups = (["functional", "non_functional"] as const)
    .map((t) => ({ type: t, items: shown.filter((r) => r.type === t) }))
    .filter((g) => g.items.length > 0);
  const filtering = type !== "all" || areas.length > 0 || q !== "";

  return (
    <div className="flex flex-col gap-4">
      {requirements.length > 0 && <AssistantSetupNote />}
      {requirements.length === 0 && <p className="text-muted">Este proyecto aún no tiene requerimientos.</p>}
      {requirements.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
            <TextField label="Buscar requerimiento" type="search" value={query} onChange={setQuery} placeholder="Título o descripción" className="sm:w-72" />
          </div>
          {usedAreas.length > 1 && (
            <fieldset className="flex flex-wrap items-center gap-1.5">
              <legend className="mb-1.5 text-sm font-medium text-ink">Área</legend>
              {usedAreas.map(({ value, label }) => {
                const on = areas.includes(value);
                const n = requirements.filter((r) => r.area === value).length;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setAreas((list) => (on ? list.filter((a) => a !== value) : [...list, value]))}
                    className={`min-h-8 rounded-full border px-3 text-sm transition-colors duration-150 ${on ? "border-brand bg-brand-soft text-brand" : "border-line-strong text-ink-soft hover:bg-subtle"}`}
                  >
                    {label} <span className="text-xs opacity-75 tabular-nums">{n}</span>
                  </button>
                );
              })}
              {filtering && (
                <button
                  type="button"
                  onClick={() => (setType("all"), setAreas([]), setQuery(""))}
                  className="ml-1 rounded-sm text-sm text-muted hover:text-ink"
                >
                  Quitar filtros
                </button>
              )}
            </fieldset>
          )}
        </div>
      )}
      {requirements.length > 0 && shown.length === 0 && <p className="text-muted">Ningún requerimiento coincide con estos filtros.</p>}
      {groups.map((group) => (
        <section key={group.type} aria-label={`Requerimientos ${REQUIREMENT_TYPE_LABEL[group.type].toLowerCase()}`} className="flex flex-col gap-3">
          {(type === "all" && groups.length > 1) || type !== "all" ? (
            <h2 className="flex items-baseline gap-2 pt-1 text-sm font-semibold tracking-wide text-muted uppercase">
              {group.type === "functional" ? "Funcionales" : "No funcionales"}
              <span className="font-normal normal-case tabular-nums">{group.items.length}</span>
            </h2>
          ) : null}
          {group.items.map((requirement) => (
            <ProjectDetailRequirementCard key={requirement.id} requirement={requirement} view={view} />
          ))}
        </section>
      ))}
      <ProjectDetailRequirementForm projectId={project.id} />
    </div>
  );
};

export default ProjectDetailRequirements;
