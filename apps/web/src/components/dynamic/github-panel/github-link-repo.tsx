import type { FormEvent } from "react";
import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import TextField from "@/components/ui/text-field/text-field";
import useLinkRepo from "@/hooks/form/use-link-repo";

const GithubLinkRepo = ({ projectId }: { projectId: string }) => {
  const { url, setUrl, error, submit, link } = useLinkRepo(projectId);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  return (
    <section className="flex max-w-xl flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <h3 className="font-semibold text-ink">Vincula un repositorio de GitHub</h3>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <TextField
          label="URL del repositorio"
          hideLabel
          value={url}
          onChange={setUrl}
          placeholder="https://github.com/organizacion/repositorio"
          error={error}
          hint="Los proyectos creados desde un repositorio local con remoto en GitHub se vinculan solos."
          spellCheck={false}
          autoComplete="off"
          className="flex-1"
        />
        <Button type="submit" variant="primary" isLoading={link.isPending}>
          Vincular
        </Button>
      </form>
      {link.isError && <Alert>{link.error.message}</Alert>}
    </section>
  );
};

export default GithubLinkRepo;
