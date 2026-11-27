import { assignRequirementCodes, settleClassification } from "@agent-tracking/core";
import { useState } from "react";
import AssistantSetupNote from "@/components/dynamic/assistant/assistant-setup-note";
import RequirementsImportDialog from "@/components/dynamic/requirements-import/requirements-import-dialog";
import Button from "@/components/ui/button/button";
import useWizardStore, { projectShape } from "@/stores/use-wizard-store";
import NewProjectRequirementCard from "./new-project-requirement-card";

const NewProjectRequirements = () => {
  const requirements = useWizardStore((s) => s.requirements);
  const addRequirement = useWizardStore((s) => s.addRequirement);
  const importRequirements = useWizardStore((s) => s.importRequirements);
  const kind = useWizardStore((s) => projectShape(s).kind);
  const [importing, setImporting] = useState(false);
  // The codes they will get: numbered by type, as the server does when the project is created.
  const codes = assignRequirementCodes(
    requirements.map((r) => ({ type: settleClassification({ type: r.type ?? undefined, area: r.area ?? undefined }, r.title, r.description, kind).type })),
  ).map((r) => r.code);

  return (
    <div className="flex flex-col gap-4">
      <AssistantSetupNote />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-line-strong px-4 py-3">
        <p className="text-sm text-ink-soft">¿Ya los tienes escritos? Pega un Markdown o JSON con los requerimientos y su Definition of Done.</p>
        <Button size="sm" onClick={() => setImporting(true)}>
          Importar
        </Button>
      </div>
      {requirements.map((requirement, index) => (
        <NewProjectRequirementCard key={requirement.key} requirement={requirement} index={index} code={codes[index]!} />
      ))}
      <div>
        <Button onClick={addRequirement}>Agregar requerimiento</Button>
      </div>
      <RequirementsImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        kind={kind}
        onImport={(_text, list) => {
          importRequirements(list);
          setImporting(false);
        }}
      />
    </div>
  );
};

export default NewProjectRequirements;
