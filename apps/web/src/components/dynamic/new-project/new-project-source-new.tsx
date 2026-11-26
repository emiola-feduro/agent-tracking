import { useState, type FormEvent } from "react";
import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import Segmented from "@/components/ui/segmented/segmented";
import TextField from "@/components/ui/text-field/text-field";
import useRepoSource from "@/hooks/form/use-repo-source";
import useWizardStore from "@/stores/use-wizard-store";

type BranchChoice = "main" | "master" | "other";

/** Creates an empty git repository for a project that starts from scratch, on the branch the person picks. */
const NewProjectSourceNew = () => {
  const { cloneRoot, init } = useRepoSource();
  const repo = useWizardStore((s) => s.repo);
  const [path, setPath] = useState<string | null>(null);
  const [choice, setChoice] = useState<BranchChoice>("main");
  const [other, setOther] = useState("");
  const value = path ?? (cloneRoot ? `${cloneRoot}/` : "");
  const branch = choice === "other" ? other.trim() : choice;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim() && branch) init.mutate({ path: value.trim(), branch });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">Rama principal</span>
        <Segmented
          label="Rama principal"
          items={[
            { value: "main", label: "main" },
            { value: "master", label: "master" },
            { value: "other", label: "Otra" },
          ]}
          value={choice}
          onChange={setChoice}
        />
        {choice === "other" && (
          <TextField
            className="max-w-xs"
            label="Nombre de la rama"
            value={other}
            onChange={setOther}
            placeholder="develop"
            spellCheck={false}
            autoComplete="off"
          />
        )}
        <p className="text-sm text-muted">
          La rama donde empieza el repositorio. Los agentes no pueden borrar ni reescribir main, master ni la rama principal del remoto.
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextField
          className="flex-1"
          label="Carpeta del nuevo repositorio"
          value={value}
          onChange={setPath}
          placeholder="/home/usuario/proyectos/mi-proyecto"
          hint="Debe estar vacía o no existir."
          spellCheck={false}
          autoComplete="off"
        />
        <Button type="submit" isLoading={init.isPending} disabled={!value.trim() || !branch || repo?.repo.root === value.trim().replace(/\/+$/, "")}>
          Crear repositorio
        </Button>
      </form>
      {init.isError && <Alert>{init.error.message}</Alert>}
      {repo && (
        <Alert tone="info">
          Repositorio creado en <code className="font-mono text-[0.8125rem] break-all">{repo.repo.root}</code>, rama{" "}
          <code className="font-mono text-[0.8125rem]">{repo.repo.branch ?? "main"}</code>.
        </Alert>
      )}
    </div>
  );
};

export default NewProjectSourceNew;
