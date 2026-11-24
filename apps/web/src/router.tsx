import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import AppShell from "@/components/layout/app-shell/app-shell";
import type { ProjectTab } from "@/components/dynamic/project-detail/project-detail";
import { projectQuery } from "@/hooks/data/use-project";
import { projectsQuery } from "@/hooks/data/use-projects";
import { queryClient } from "@/lib/query-client";
import NewProjectPage from "@/pages/new-project-page";
import ProjectPage from "@/pages/project-page";
import ProjectsPage from "@/pages/projects-page";

const TABS: ProjectTab[] = [
  "requirements",
  "traceability",
  "screens",
  "worktrees",
  "activity",
  "tests",
  "pulls",
  "branches",
  "pipelines",
  "rules",
  "skills",
  "context",
];

const rootRoute = createRootRoute({ component: AppShell });

// Loaders only start the fetch (not awaited), so navigation is instant and pages show skeletons.
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  loader: () => void queryClient.prefetchQuery(projectsQuery),
  component: ProjectsPage,
});

const newProjectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/new",
  component: NewProjectPage,
});

const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
  validateSearch: (search: Record<string, unknown>): { tab?: ProjectTab } =>
    TABS.includes(search.tab as ProjectTab) ? { tab: search.tab as ProjectTab } : {},
  loader: ({ params }) => void queryClient.prefetchQuery(projectQuery(params.projectId)),
  component: function ProjectRouteComponent() {
    const { projectId } = projectRoute.useParams();
    const { tab } = projectRoute.useSearch();
    return <ProjectPage projectId={projectId} tab={tab ?? "requirements"} />;
  },
});

const routeTree = rootRoute.addChildren([indexRoute, newProjectRoute, projectRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  defaultViewTransition: true,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
