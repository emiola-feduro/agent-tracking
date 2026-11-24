import type { Requirement } from "@agent-tracking/core";
import { useState, type FormEvent } from "react";
import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import TextField from "@/components/ui/text-field/text-field";
import useTestIdeaActions from "@/hooks/data/use-test-idea-actions";

type ProjectDetailTestIdeaFormProps = {
  projectId: string;
  requirements: Requirement[];
};

const ProjectDetailTestIdeaForm = ({ projectId, requirements }: ProjectDetailTestIdeaFormProps) => {
  const [text, setText] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const { addIdea } = useTestIdeaActions(projectId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addIdea.mutate({ text: text.trim(), requirementId: requirementId || null }, { onSuccess: () => setText("") });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-t border-line pt-4">
      <TextField label="Nueva idea de test" value={text} onChange={setText} placeholder="Qué caso conviene probar" />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Requerimiento
        <select
          value={requirementId}
          onChange={(e) => setRequirementId(e.target.value)}
          className="min-h-10 rounded-md border border-line-strong bg-surface px-3 font-normal text-ink transition-colors duration-150 hover:border-muted"
        >
          <option value="">Ninguno</option>
          {requirements.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </label>
      {addIdea.isError && <Alert>{addIdea.error.message}</Alert>}
      <div>
        <Button type="submit" variant="primary" isLoading={addIdea.isPending} disabled={!text.trim()}>
          Agregar idea
        </Button>
      </div>
    </form>
  );
};

export default ProjectDetailTestIdeaForm;
