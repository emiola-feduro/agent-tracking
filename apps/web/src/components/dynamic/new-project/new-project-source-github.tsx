import { useState, type FormEvent } from "react";
import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import TextField from "@/components/ui/text-field/text-field";
import useRepoSource from "@/hooks/form/use-repo-source";
import useWizardStore from "@/stores/use-wizard-store";
import NewProjectRepoResult from "./new-project-repo-result";

const repoNameFromUrl = (url: string) => url.trim().replace(/\.git$|\/$/g, "").split("/").pop() ?? "";

const NewProjectSourceGithub = () => {
  const [url, setUrl] = useState("");
  const [dest, setDest] = useState<string | null>(null);
  const { cloneRoot, clone, importRepo } = useRepoSource();
  const repo = useWizardStore((s) => s.repo);
  const suggested = cloneRoot && repoNameFromUrl(url) ? `${cloneRoot}/${repoNameFromUrl(url)}` : "";
  const target = dest ?? suggested;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (url.trim() && target.trim()) clone.mutate({ url: url.trim(), dest: target.trim() });
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <TextField
          label="URL del repositorio"
          type="url"
          value={url}
          onChange={setUrl}
          placeholder="https://github.com/organizacion/repositorio"
          spellCheck={false}
          autoComplete="off"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextField
            className="flex-1"
            label="Carpeta destino"
            value={target}
            onChange={setDest}
            hint="Debe estar vacía o no existir."
            spellCheck={false}
          />
          <Button type="submit" isLoading={clone.isPending} disabled={!url.trim() || !target.trim()}>
            Clonar
          </Button>
        </div>
      </form>
      {clone.isError && <Alert>{clone.error.message}</Alert>}
      {repo && <NewProjectRepoResult inspection={repo} importRepo={importRepo} />}
    </div>
  );
};

export default NewProjectSourceGithub;
