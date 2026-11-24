import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { githubApi } from "@/lib/github-api";
import { queryKeys } from "@/lib/query-keys";

const GITHUB_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?(?:\.git)?\/?$/;

/** Saves the project's GitHub URL (accepts https and git@ forms). */
const useLinkRepo = (projectId: string) => {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);

  const normalized = url.trim().replace(/^git@github\.com:(.+?)(?:\.git)?$/, "https://github.com/$1");
  const isValid = GITHUB_URL.test(normalized);
  const error = touched && url.trim() && !isValid ? "Usa la forma https://github.com/organizacion/repositorio" : null;

  const link = useMutation({
    mutationFn: () => githubApi.linkRepo(projectId, normalized.replace(/(\.git)?\/?$/, "")),
    onSuccess: (view) => {
      queryClient.setQueryData(queryKeys.project(projectId), view);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects, exact: true });
    },
  });

  const submit = () => {
    setTouched(true);
    if (isValid) link.mutate();
  };

  return { url, setUrl, error, isValid, submit, link };
};

export default useLinkRepo;
