import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api, type NewProject } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import useWizardStore from "@/stores/use-wizard-store";

const buildPayload = (): NewProject => {
  const s = useWizardStore.getState();
  return {
    name: s.name.trim(),
    goal: s.goal.trim(),
    platforms: s.platforms,
    stack: s.stack,
    databases: s.databases,
    repoPath: s.repo?.repo.root ?? null,
    repoUrl: s.repoUrl.trim() || null,
    rules: s.rules.map((r) => r.trim()).filter(Boolean),
    skills: Object.values(s.skills).map(({ name, description, source, location }) => ({
      name,
      description,
      source,
      location,
      enabled: true,
    })),
    requirements: s.requirements
      .filter((r) => r.title.trim())
      .map((r) => ({
        title: r.title.trim(),
        description: r.description.trim(),
        dod: [
          ...r.dod.map((d) => d.trim()).filter(Boolean).map((criterion) => ({ criterion, origin: "human" as const })),
          ...r.llmDod.map((criterion) => ({ criterion, origin: "llm" as const })),
        ],
      })),
  };
};

const useCreateProject = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => api.createProject(buildPayload()),
    onSuccess: (view) => {
      queryClient.setQueryData(queryKeys.project(view.project.id), view);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects, exact: true });
      navigate({ to: "/projects/$projectId", params: { projectId: view.project.id }, search: { tab: "requirements" } });
    },
  });
};

export default useCreateProject;
