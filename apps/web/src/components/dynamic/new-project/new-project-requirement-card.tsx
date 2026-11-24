import RemoveButton from "@/components/ui/remove-button/remove-button";
import SelectField from "@/components/ui/select-field/select-field";
import type { RequirementArea, RequirementType } from "@/lib/api";
import { REQUIREMENT_AREA_OPTIONS, REQUIREMENT_TYPE_OPTIONS } from "@/lib/labels";
import TextAreaField from "@/components/ui/text-area-field/text-area-field";
import TextField from "@/components/ui/text-field/text-field";
import useWizardStore, { type RequirementDraft } from "@/stores/use-wizard-store";
import NewProjectRequirementDod from "./new-project-requirement-dod";

type NewProjectRequirementCardProps = {
  requirement: RequirementDraft;
  index: number;
};

const NewProjectRequirementCard = ({ requirement, index }: NewProjectRequirementCardProps) => {
  const { key, title, description, type, area } = requirement;
  const setRequirement = useWizardStore((s) => s.setRequirement);
  const removeRequirement = useWizardStore((s) => s.removeRequirement);
  const number = index + 1;

  return (
    <article className="flex animate-enter flex-col gap-4 rounded-md border border-line p-4">
      <div className="flex items-end gap-2">
        <TextField
          className="flex-1"
          label={`Requerimiento ${number}`}
          value={title}
          onChange={(v) => setRequirement(key, { title: v })}
          placeholder="El cliente puede pagar con tarjeta"
        />
        <RemoveButton label={`Quitar requerimiento ${number}`} onClick={() => removeRequirement(key)} />
      </div>
      <TextAreaField
        label="Descripción"
        value={description}
        onChange={(v) => setRequirement(key, { description: v })}
        rows={2}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Tipo" value={type} onChange={(v) => setRequirement(key, { type: v as RequirementType })} options={REQUIREMENT_TYPE_OPTIONS} />
        <SelectField label="Área" value={area} onChange={(v) => setRequirement(key, { area: v as RequirementArea })} options={REQUIREMENT_AREA_OPTIONS} />
      </div>
      <NewProjectRequirementDod requirement={requirement} />
    </article>
  );
};

export default NewProjectRequirementCard;
