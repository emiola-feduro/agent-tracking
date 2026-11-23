import { useState, type FormEvent } from "react";
import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import TextField from "@/components/ui/text-field/text-field";
import useRepoSource from "@/hooks/form/use-repo-source";
import useWizardStore from "@/stores/use-wizard-store";
import NewProjectRepoResult from "./new-project-repo-result";

const NewProjectSourceLocal = () => {
  const current = useWizardStore((s) => s.repo?.repo.root ?? "");
  const [path, setPath] = useState(current);
  const { inspect, importRepo } = useRepoSource();
  const repo = useWizardStore((s) => s.repo);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (path.trim()) inspect.mutate(path.trim());
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextField
          className="flex-1"
          label="Ruta absoluta del repositorio"
          value={path}
          onChange={setPath}
          placeholder="/home/usuario/proyectos/tienda"
          spellCheck={false}
          autoComplete="off"
        />
        <Button type="submit" isLoading={inspect.isPending} disabled={!path.trim()}>
          Revisar repositorio
        </Button>
      </form>
      {inspect.isError && <Alert>{inspect.error.message}</Alert>}
      {repo && <NewProjectRepoResult inspection={repo} importRepo={importRepo} />}
    </div>
  );
};

export default NewProjectSourceLocal;
