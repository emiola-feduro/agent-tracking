import { AREA_GROUP_LABEL, REQUIREMENT_AREA_LABEL, REQUIREMENT_TYPE_HINT, REQUIREMENT_TYPE_LABEL, settleClassification, type ProjectKind } from "@agent-tracking/core";
import SelectField from "@/components/ui/select-field/select-field";
import type { RequirementArea, RequirementType } from "@/lib/api";
import { areaOptionsFor } from "@/lib/labels";

export type ClassificationDraft = { type: RequirementType | null; area: RequirementArea | null };

type Props = {
  value: ClassificationDraft;
  onChange: (value: ClassificationDraft) => void;
  title: string;
  description: string;
  kind: ProjectKind;
};

const AUTO = "auto";

/**
 * Type and area for a new requirement. By default both are deduced from the text, and the result is
 * shown live so it is clear what will be saved; choosing a type narrows the areas to the ones that fit.
 */
const ClassificationFields = ({ value, onChange, title, description, kind }: Props) => {
  const settled = settleClassification({ type: value.type ?? undefined, area: value.area ?? undefined }, title, description, kind);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Tipo"
          value={value.type ?? AUTO}
          onChange={(v) => onChange({ type: v === AUTO ? null : (v as RequirementType), area: null })}
          options={[
            { value: AUTO, label: "Deducir del texto" },
            { value: "functional", label: REQUIREMENT_TYPE_LABEL.functional },
            { value: "non_functional", label: REQUIREMENT_TYPE_LABEL.non_functional },
          ]}
        />
        <SelectField
          label={value.type ? AREA_GROUP_LABEL[value.type] : "Área"}
          value={value.area ?? AUTO}
          onChange={(v) => onChange({ ...value, area: v === AUTO ? null : (v as RequirementArea) })}
          options={[{ value: AUTO, label: "Deducir del texto" }, ...(value.type ? areaOptionsFor(value.type) : [...areaOptionsFor("functional"), ...areaOptionsFor("non_functional")])]}
        />
      </div>
      <p className="text-xs text-muted">
        {title.trim() ? (
          <>
            Se guardará como <strong className="font-medium text-ink-soft">{REQUIREMENT_TYPE_LABEL[settled.type].toLowerCase()}</strong>,{" "}
            {REQUIREMENT_AREA_LABEL[settled.area].toLowerCase()}. {REQUIREMENT_TYPE_HINT[settled.type]}
          </>
        ) : (
          "Escribe el título y verás cómo se clasifica."
        )}
      </p>
    </div>
  );
};

export default ClassificationFields;
