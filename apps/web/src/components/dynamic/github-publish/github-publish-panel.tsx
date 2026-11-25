import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Button from "@/components/ui/button/button";
import { api, type GithubPublish, type Project } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import GithubPublishFields, { isValidRepoName } from "./github-publish-fields";

/** For a local repository without a remote: create it on GitHub from the project page. */
const GithubPublishPanel = ({ project }: { project: Project }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const folder = project.repoPath?.split("/").pop() ?? project.name;
  const [value, setValue] = useState<GithubPublish>({ owner: "", name: folder, visibility: "private" });
  const publish = useMutation({
    mutationFn: () => api.publishGithub(project.id, { ...value, description: project.goal }),
    onSuccess: () => {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.project(project.id) });
    },
  });

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Crear en GitHub
      </Button>
    );
  }
  return (
    <div className="mt-2 flex w-full flex-col gap-3 rounded-md border border-line p-4">
      <GithubPublishFields value={value} onChange={setValue} />
      {publish.isError && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{(publish.error as Error).message}</p>}
      <div className="flex gap-2">
        <Button variant="primary" size="sm" isLoading={publish.isPending} disabled={!value.owner || !isValidRepoName(value.name)} onClick={() => publish.mutate()}>
          Crear repositorio {value.visibility === "private" ? "privado" : "público"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
};

export default GithubPublishPanel;
