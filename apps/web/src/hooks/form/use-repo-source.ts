import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import useWizardStore from "@/stores/use-wizard-store";

/** Inspect a local repo, create a new one, clone one from GitHub, or import a repo that already has a project file. */
const useRepoSource = () => {
  const setRepo = useWizardStore((s) => s.setRepo);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const cloneRoot = useQuery({ queryKey: queryKeys.cloneRoot, queryFn: api.cloneRoot, staleTime: Infinity });

  const inspect = useMutation({ mutationFn: api.inspectRepo, onSuccess: setRepo, onMutate: () => setRepo(null) });

  const init = useMutation({ mutationFn: api.initRepo, onSuccess: setRepo, onMutate: () => setRepo(null) });

  const clone = useMutation({
    mutationFn: ({ url, dest }: { url: string; dest: string }) => api.cloneRepo(url, dest),
    onSuccess: setRepo,
    onMutate: () => setRepo(null),
  });

  const importRepo = useMutation({
    mutationFn: api.importRepo,
    onSuccess: (view) => {
      queryClient.setQueryData(queryKeys.project(view.project.id), view);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects, exact: true });
      navigate({ to: "/projects/$projectId", params: { projectId: view.project.id }, search: { tab: "requirements" } });
    },
  });

  return { cloneRoot: cloneRoot.data?.cloneRoot ?? null, inspect, init, clone, importRepo };
};

export default useRepoSource;
