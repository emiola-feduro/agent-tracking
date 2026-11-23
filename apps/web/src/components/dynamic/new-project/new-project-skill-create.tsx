import { useState, type FormEvent } from "react";
import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import TextAreaField from "@/components/ui/text-area-field/text-area-field";
import TextField from "@/components/ui/text-field/text-field";
import useCreateSkill from "@/hooks/form/use-create-skill";
import useWizardStore from "@/stores/use-wizard-store";

const NewProjectSkillCreate = () => {
  const repoPath = useWizardStore((s) => s.repo?.repo.root ?? null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<"user" | "repo">(repoPath ? "repo" : "user");
  const create = useCreateSkill();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { name, description, body, target, repoPath: repoPath ?? undefined },
      { onSuccess: () => (setName(""), setDescription(""), setBody("")) },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-md border border-dashed border-line-strong p-5">
      <h3 className="font-semibold text-ink">Crear una skill nueva</h3>
      <TextField label="Nombre" value={name} onChange={setName} placeholder="Convenciones de API" required />
      <TextField
        label="Cuándo debe usarla el agente"
        value={description}
        onChange={setDescription}
        placeholder="Al crear o modificar endpoints REST"
        required
      />
      <TextAreaField label="Instrucciones" value={body} onChange={setBody} placeholder="Pasos, convenciones y ejemplos" />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">Guardar en</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="skill-target" checked={target === "repo"} disabled={!repoPath} onChange={() => setTarget("repo")} className="accent-brand" />
          <span className={repoPath ? "" : "text-muted"}>El repositorio del proyecto (la comparten los colaboradores)</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="skill-target" checked={target === "user"} onChange={() => setTarget("user")} className="accent-brand" />
          Mis skills en ~/.claude/skills
        </label>
      </fieldset>
      {create.isError && <Alert>{create.error.message}</Alert>}
      {create.isSuccess && <Alert tone="info">Skill "{create.data.name}" creada y seleccionada.</Alert>}
      <div>
        <Button type="submit" isLoading={create.isPending} disabled={!name.trim() || !description.trim()}>
          Crear y seleccionar
        </Button>
      </div>
    </form>
  );
};

export default NewProjectSkillCreate;
