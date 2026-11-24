import { useState, type FormEvent } from "react";
import Button from "@/components/ui/button/button";
import SelectField from "@/components/ui/select-field/select-field";
import TextAreaField from "@/components/ui/text-area-field/text-area-field";
import TextField from "@/components/ui/text-field/text-field";
import useProjectActions from "@/hooks/data/use-project-actions";
import type { RequirementArea, RequirementType } from "@/lib/api";
import { REQUIREMENT_AREA_OPTIONS, REQUIREMENT_TYPE_OPTIONS } from "@/lib/labels";

const ProjectDetailRequirementForm = ({ projectId }: { projectId: string }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<RequirementType>("functional");
  const [area, setArea] = useState<RequirementArea>("general");
  const { addRequirement } = useProjectActions(projectId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addRequirement.mutate(
      { title: title.trim(), description: description.trim(), type, area },
      { onSuccess: () => (setTitle(""), setDescription("")) },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-dashed border-line-strong p-5">
      <h2 className="font-semibold text-ink">Nuevo requerimiento</h2>
      <TextField label="Título" value={title} onChange={setTitle} />
      <TextAreaField label="Descripción" value={description} onChange={setDescription} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Tipo" value={type} onChange={(v) => setType(v as RequirementType)} options={REQUIREMENT_TYPE_OPTIONS} />
        <SelectField label="Área" value={area} onChange={(v) => setArea(v as RequirementArea)} options={REQUIREMENT_AREA_OPTIONS} />
      </div>
      <div>
        <Button type="submit" variant="primary" isLoading={addRequirement.isPending} disabled={!title.trim()}>
          Agregar requerimiento
        </Button>
      </div>
    </form>
  );
};

export default ProjectDetailRequirementForm;
