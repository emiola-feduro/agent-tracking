import ListEditor from "@/components/ui/list-editor/list-editor";
import RemoveButton from "@/components/ui/remove-button/remove-button";
import TextAreaField from "@/components/ui/text-area-field/text-area-field";
import TextField from "@/components/ui/text-field/text-field";
import useWizardStore, { type RequirementDraft } from "@/stores/use-wizard-store";

type NewProjectRequirementCardProps = {
  requirement: RequirementDraft;
  index: number;
};

const NewProjectRequirementCard = ({ requirement, index }: NewProjectRequirementCardProps) => {
  const { key, title, description, dod } = requirement;
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
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-ink">Definition of Done</h3>
        <ListEditor
          values={dod}
          onChange={(v) => setRequirement(key, { dod: v })}
          itemLabel="Criterio"
          placeholder="Criterio verificable"
          addLabel="Agregar criterio"
        />
      </section>
    </article>
  );
};

export default NewProjectRequirementCard;
