import { kindPlatforms } from "@agent-tracking/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api, type NewProject } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import useNoticeStore from "@/stores/use-notice-store";
import useWizardStore from "@/stores/use-wizard-store";

const buildPayload = (): NewProject => {
  const s = useWizardStore.getState();
  return {
    name: s.name.trim(),
    goal: s.goal.trim(),
    kind: s.kind,
    commitConventions: s.commitConventions,
    agents: s.repo ? s.agents : [],
    platforms: kindPlatforms(s.kind, s.platforms),
    stack: s.stack,
    databases: s.databases,
    repoPath: s.repo?.repo.root ?? null,
    repoUrl: s.repoUrl.trim() || null,
    githubFiles: s.repo ? s.githubFiles : [],
    prTemplate: s.repo && s.githubFiles.includes("prTemplate") && s.prTemplate !== null ? s.prTemplate : undefined,
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
        type: r.type ?? undefined,
        area: r.area ?? undefined,
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
    mutationFn: async () => {
      const view = await api.createProject(buildPayload());
      const { publish } = useWizardStore.getState();
      // The project exists already; a GitHub failure is reported on its page, where it can be retried.
      if (view.project.repoPath && publish?.enabled) {
        try {
          const { enabled: _enabled, ...data } = publish;
          const done = await api.publishGithub(view.project.id, { ...data, description: view.project.goal });
          useNoticeStore.getState().set(view.project.id, { tone: "info", text: `Repositorio creado en GitHub: ${done.repoUrl}` });
          return { ...view, project: { ...view.project, repoUrl: done.repoUrl } };
        } catch (e) {
          useNoticeStore.getState().set(view.project.id, { tone: "warn", text: `El proyecto se creó, pero no se pudo crear el repositorio en GitHub: ${(e as Error).message}` });
        }
      }
      return view;
    },
    onSuccess: (view) => {
      queryClient.setQueryData(queryKeys.project(view.project.id), view);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects, exact: true });
      navigate({ to: "/projects/$projectId", params: { projectId: view.project.id }, search: { tab: "overview" } });
    },
  });
};

export default useCreateProject;
