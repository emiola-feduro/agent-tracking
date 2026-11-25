import { useState, type FormEvent } from "react";
import ClassificationFields, { type ClassificationDraft } from "@/components/dynamic/requirement-classification/classification-fields";
import Button from "@/components/ui/button/button";
import TextAreaField from "@/components/ui/text-area-field/text-area-field";
import TextField from "@/components/ui/text-field/text-field";
import useProjectActions from "@/hooks/data/use-project-actions";
import type { ProjectKind } from "@/lib/api";

const ProjectDetailRequirementForm = ({ projectId, kind }: { projectId: string; kind: ProjectKind }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classification, setClassification] = useState<ClassificationDraft>({ type: null, area: null });
  const { addRequirement } = useProjectActions(projectId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addRequirement.mutate(
      { title: title.trim(), description: description.trim(), type: classification.type ?? undefined, area: classification.area ?? undefined },
      { onSuccess: () => (setTitle(""), setDescription(""), setClassification({ type: null, area: null })) },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-dashed border-line-strong p-5">
      <h2 className="font-semibold text-ink">Nuevo requerimiento</h2>
      <TextField label="Título" value={title} onChange={setTitle} />
      <TextAreaField label="Descripción" value={description} onChange={setDescription} />
      <ClassificationFields value={classification} onChange={setClassification} title={title} description={description} kind={kind} />
      <div>
        <Button type="submit" variant="primary" isLoading={addRequirement.isPending} disabled={!title.trim()}>
          Agregar requerimiento
        </Button>
      </div>
    </form>
  );
};

export default ProjectDetailRequirementForm;
