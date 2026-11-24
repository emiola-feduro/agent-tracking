import { useState, type FormEvent } from "react";
import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import TextField from "@/components/ui/text-field/text-field";
import useRepoSource from "@/hooks/form/use-repo-source";
import useWizardStore from "@/stores/use-wizard-store";

/** Creates an empty git repository (branch main) for a project that starts from scratch. */
const NewProjectSourceNew = () => {
  const { cloneRoot, init } = useRepoSource();
  const repo = useWizardStore((s) => s.repo);
  const [path, setPath] = useState<string | null>(null);
  const value = path ?? (cloneRoot ? `${cloneRoot}/` : "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) init.mutate(value.trim());
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextField
          className="flex-1"
          label="Carpeta del nuevo repositorio"
          value={value}
          onChange={setPath}
          placeholder="/home/usuario/proyectos/mi-proyecto"
          hint="Debe estar vacía o no existir. Se crea con git en la rama main."
          spellCheck={false}
          autoComplete="off"
        />
        <Button type="submit" isLoading={init.isPending} disabled={!value.trim() || repo?.repo.root === value.trim().replace(/\/+$/, "")}>
          Crear repositorio
        </Button>
      </form>
      {init.isError && <Alert>{init.error.message}</Alert>}
      {repo && (
        <Alert tone="info">
          Repositorio creado en <code className="font-mono text-[13px] break-all">{repo.repo.root}</code>, rama{" "}
          <code className="font-mono text-[13px]">{repo.repo.branch ?? "main"}</code>.
        </Alert>
      )}
    </div>
  );
};

export default NewProjectSourceNew;
