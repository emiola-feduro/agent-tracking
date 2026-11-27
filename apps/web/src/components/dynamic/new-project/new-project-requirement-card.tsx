import RemoveButton from "@/components/ui/remove-button/remove-button";
import PartChips from "@/components/dynamic/requirement-parts/part-chips";
import ClassificationFields from "@/components/dynamic/requirement-classification/classification-fields";
import TextAreaField from "@/components/ui/text-area-field/text-area-field";
import TextField from "@/components/ui/text-field/text-field";
import useWizardStore, { projectShape, type RequirementDraft } from "@/stores/use-wizard-store";
import NewProjectRequirementDod from "./new-project-requirement-dod";

type NewProjectRequirementCardProps = {
  requirement: RequirementDraft;
  index: number;
  /** The code it will get (RF1, RNF1…), from its type as it stands. */
  code: string;
};

const NO_PARTS: never[] = [];

const NewProjectRequirementCard = ({ requirement, index, code }: NewProjectRequirementCardProps) => {
  const { key, title, description, type, area, parts: touched } = requirement;
  const parts = useWizardStore((s) => (s.structure === "monorepo" ? s.parts : NO_PARTS));
  const setRequirement = useWizardStore((s) => s.setRequirement);
  const removeRequirement = useWizardStore((s) => s.removeRequirement);
  const kind = useWizardStore((s) => projectShape(s).kind);
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
      <p className="-mt-2 text-sm text-muted">
        Código <span className="font-mono font-medium text-brand">{code}</span>: con él te refieres a este requerimiento en la app y con los agentes. Lo
        puedes cambiar después.
      </p>
      <TextAreaField label="Descripción" value={description} onChange={(v) => setRequirement(key, { description: v })} rows={2} />
      <ClassificationFields value={{ type, area }} onChange={(c) => setRequirement(key, c)} title={title} description={description} kind={kind} />
      <PartChips parts={parts} value={touched} onChange={(next) => setRequirement(key, { parts: next })} />
      <NewProjectRequirementDod requirement={requirement} />
    </article>
  );
};

export default NewProjectRequirementCard;
