import GithubBranches from "@/components/dynamic/github-branches/github-branches";
import GithubPanel from "@/components/dynamic/github-panel/github-panel";
import GithubPipelines from "@/components/dynamic/github-pipelines/github-pipelines";
import GithubPulls from "@/components/dynamic/github-pulls/github-pulls";
import CollabProject from "@/components/dynamic/collab/collab-project";
import Tabs from "@/components/ui/tabs/tabs";
import type { ProjectView } from "@/lib/api";
import ProjectDetailActivity from "./project-detail-activity";
import ProjectDetailAgents from "./project-detail-agents";
import ProjectDetailCheckoutMenu from "./project-detail-checkout-menu";
import ProjectDetailWorktreeBanner from "./project-detail-worktree-banner";
import ProjectDetailContext from "./project-detail-context";
import ProjectDetailConventions from "./project-detail-conventions";
import ProjectDetailArchitecture from "./project-detail-architecture";
import ProjectDetailIntegrate from "./project-detail-integrate";
import ProjectDetailLastTurn from "./project-detail-last-turn";
import ProjectDetailLive from "./project-detail-live";
import ProjectDetailNav, { NAV_ICONS, type NavGroup } from "./project-detail-nav";
import ProjectDetailRequirements from "./project-detail-requirements";
import ProjectDetailRules from "./project-detail-rules";
import ProjectDetailScreens from "./project-detail-screens";
import ProjectDetailSkills from "./project-detail-skills";
import ProjectDetailSummary from "./project-detail-summary";
import ProjectDetailTests from "./project-detail-tests";
import ProjectDetailTraceability from "./project-detail-traceability";
import ProjectDetailTurnToast from "./project-detail-turn-toast";
import ProjectDetailWorktrees from "./project-detail-worktrees";

export type GithubTab = "pulls" | "branches" | "pipelines";
export type ProjectTab =
  | "overview"
  | "requirements"
  | "traceability"
  | "screens"
  | "worktrees"
  | "activity"
  | "tests"
  | GithubTab
  | "rules"
  | "skills"
  | "context"
  | "agents"
  | "collab";

type ProjectDetailProps = {
  view: ProjectView;
  tab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
};

/**
 * A project: sections in a sidebar on wide screens (tabs on narrow ones). What the agent is doing
 * right now stays on top in every section; the summary and the last turn live in Resumen.
 */
const ProjectDetail = ({ view, tab, onTabChange }: ProjectDetailProps) => {
  const { requirements, rules, skills, tests, attachments, project } = view;
  const screens = attachments.filter((a) => a.kind === "screen").length;
  const groups: NavGroup[] = [
    { items: [{ value: "overview", label: "Resumen", icon: NAV_ICONS.overview }] },
    {
      label: "Trabajo",
      items: [
        { value: "requirements", label: "Requerimientos", count: requirements.length, icon: NAV_ICONS.requirements },
        { value: "traceability", label: "Trazabilidad", icon: NAV_ICONS.traceability },
        { value: "screens", label: "Vistas", count: screens || undefined, icon: NAV_ICONS.screens },
        { value: "activity", label: "Actividad", icon: NAV_ICONS.activity },
        { value: "tests", label: "Tests", count: tests.length, icon: NAV_ICONS.tests },
      ],
    },
    {
      label: "Código",
      items: [
        ...(project.repoPath ? [{ value: "worktrees" as const, label: "Ramas y worktrees", icon: NAV_ICONS.worktrees }] : []),
        { value: "pulls", label: "Pull requests", icon: NAV_ICONS.pulls },
        { value: "branches", label: "Ramas en GitHub", icon: NAV_ICONS.branches },
        { value: "pipelines", label: "Pipelines", icon: NAV_ICONS.pipelines },
      ],
    },
    {
      label: "Proyecto",
      items: [
        { value: "rules", label: "Reglas y convenciones", count: rules.length, icon: NAV_ICONS.rules },
        { value: "skills", label: "Skills", count: skills.filter((k) => k.enabled).length, icon: NAV_ICONS.skills },
        { value: "context", label: "Contexto", icon: NAV_ICONS.context },
        { value: "agents", label: "Agentes", count: (project.agents ?? []).length || undefined, icon: NAV_ICONS.agents },
        { value: "collab", label: "Colaboración", icon: NAV_ICONS.collab },
      ],
    },
  ];
  const flat = groups.flatMap((g) => g.items);
  const current = flat.some((i) => i.value === tab) ? tab : "overview";

  return (
    <div className="flex animate-enter flex-col gap-6 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      <aside className="hidden lg:block">
        <div className="sticky top-20 z-20 flex flex-col gap-4">
          {project.repoPath && <ProjectDetailCheckoutMenu projectId={project.id} />}
          <ProjectDetailNav projectId={project.id} groups={groups} active={current} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-col gap-6">
        <div className="relative z-20 flex flex-col gap-3 lg:hidden">
          {project.repoPath && <ProjectDetailCheckoutMenu projectId={project.id} />}
          <Tabs
            label="Secciones del proyecto"
            items={flat.map((i) => ({ value: i.value, label: i.count !== undefined ? `${i.label} (${i.count})` : i.label }))}
            value={current}
            onChange={onTabChange}
          />
        </div>
        <ProjectDetailWorktreeBanner projectId={project.id} />
        <ProjectDetailLive view={view} />
        <ProjectDetailTurnToast projectId={project.id} onOverview={current === "overview"} />
        <div key={current} className="flex animate-enter flex-col gap-6" role="region" aria-label={flat.find((i) => i.value === current)?.label}>
          {current === "overview" && (
            <>
              <ProjectDetailSummary view={view} />
              {project.repoPath && <ProjectDetailIntegrate projectId={project.id} />}
              <ProjectDetailLastTurn projectId={project.id} />
            </>
          )}
          {current === "requirements" && <ProjectDetailRequirements view={view} />}
          {current === "traceability" && <ProjectDetailTraceability view={view} />}
          {current === "screens" && <ProjectDetailScreens view={view} />}
          {current === "worktrees" && project.repoPath && <ProjectDetailWorktrees projectId={project.id} />}
          {current === "activity" && <ProjectDetailActivity projectId={project.id} />}
          {current === "tests" && <ProjectDetailTests view={view} />}
          {current === "rules" && (
            <>
              <ProjectDetailRules view={view} />
              <ProjectDetailArchitecture view={view} />
              <ProjectDetailConventions view={view} />
            </>
          )}
          {current === "skills" && <ProjectDetailSkills view={view} />}
          {current === "context" && <ProjectDetailContext view={view} />}
          {current === "agents" && <ProjectDetailAgents view={view} />}
          {current === "collab" && <CollabProject projectId={project.id} />}
          {(current === "pulls" || current === "branches" || current === "pipelines") && (
            <GithubPanel project={project}>
              {current === "pulls" && <GithubPulls projectId={project.id} />}
              {current === "branches" && <GithubBranches projectId={project.id} />}
              {current === "pipelines" && <GithubPipelines projectId={project.id} />}
            </GithubPanel>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
