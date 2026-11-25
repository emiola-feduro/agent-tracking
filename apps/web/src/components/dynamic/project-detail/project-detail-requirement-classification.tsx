import { AREA_GROUP_LABEL, classifyRequirement, REQUIREMENT_AREA_LABEL, REQUIREMENT_TYPE_HINT, REQUIREMENT_TYPE_LABEL, type ProjectKind } from "@agent-tracking/core";
import Segmented from "@/components/ui/segmented/segmented";
import SelectField from "@/components/ui/select-field/select-field";
import type { Requirement, RequirementArea, RequirementType } from "@/lib/api";
import { areaOptionsFor } from "@/lib/labels";

type Props = {
  requirement: Pick<Requirement, "title" | "description" | "type" | "area">;
  kind: ProjectKind;
  onChange: (change: { type?: RequirementType; area?: RequirementArea }) => void;
};

/**
 * Type and area explained in place: functional means what the system does (and where), non
 * functional means how well (which quality). When the text suggests otherwise, says so.
 */
const ProjectDetailRequirementClassification = ({ requirement, kind, onChange }: Props) => {
  const { title, description, type, area } = requirement;
  const guess = classifyRequirement(title, description, kind);
  const differs = guess.type !== type || guess.area !== area;

  return (
    <section aria-label="Clasificación" className="flex flex-col gap-3 rounded-md border border-line bg-subtle/40 p-3">
      <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Tipo</span>
          <Segmented<RequirementType>
            label="Tipo de requerimiento"
            value={type}
            onChange={(t) => onChange({ type: t })}
            items={[
              { value: "functional", label: REQUIREMENT_TYPE_LABEL.functional },
              { value: "non_functional", label: REQUIREMENT_TYPE_LABEL.non_functional },
            ]}
          />
        </div>
        <SelectField label={AREA_GROUP_LABEL[type]} value={area} onChange={(v) => onChange({ area: v as RequirementArea })} options={areaOptionsFor(type)} />
      </div>
      <p className="text-xs text-muted">{REQUIREMENT_TYPE_HINT[type]}</p>
      {differs && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
          <span>
            Por el texto parece <strong className="font-medium text-ink">{REQUIREMENT_TYPE_LABEL[guess.type].toLowerCase()}</strong>,{" "}
            {REQUIREMENT_AREA_LABEL[guess.area].toLowerCase()} ({guess.reason}).
          </span>
          <button type="button" onClick={() => onChange({ type: guess.type, area: guess.area })} className="rounded-sm text-sm font-medium text-brand hover:underline">
            Usar esta clasificación
          </button>
        </p>
      )}
    </section>
  );
};

export default ProjectDetailRequirementClassification;
