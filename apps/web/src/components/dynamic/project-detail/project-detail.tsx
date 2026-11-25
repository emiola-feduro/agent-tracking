import GithubBranches from "@/components/dynamic/github-branches/github-branches";
import GithubPanel from "@/components/dynamic/github-panel/github-panel";
import GithubPipelines from "@/components/dynamic/github-pipelines/github-pipelines";
import GithubPulls from "@/components/dynamic/github-pulls/github-pulls";
import Tabs from "@/components/ui/tabs/tabs";
import type { ProjectView } from "@/lib/api";
import ProjectDetailActivity from "./project-detail-activity";
import ProjectDetailContext from "./project-detail-context";
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
  | "context";

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
        { value: "rules", label: "Reglas", count: rules.length, icon: NAV_ICONS.rules },
        { value: "skills", label: "Skills", count: skills.filter((k) => k.enabled).length, icon: NAV_ICONS.skills },
        { value: "context", label: "Contexto", icon: NAV_ICONS.context },
      ],
    },
  ];
  const flat = groups.flatMap((g) => g.items);
  const current = flat.some((i) => i.value === tab) ? tab : "overview";

  return (
    <div className="flex animate-enter flex-col gap-6 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      <aside className="hidden lg:block">
        <ProjectDetailNav projectId={project.id} groups={groups} active={current} />
      </aside>
      <div className="flex min-w-0 flex-col gap-6">
        <div className="lg:hidden">
          <Tabs
            label="Secciones del proyecto"
            items={flat.map((i) => ({ value: i.value, label: i.count !== undefined ? `${i.label} (${i.count})` : i.label }))}
            value={current}
            onChange={onTabChange}
          />
        </div>
        <ProjectDetailLive view={view} />
        <div key={current} className="flex animate-enter flex-col gap-6" role="region" aria-label={flat.find((i) => i.value === current)?.label}>
          {current === "overview" && (
            <>
              <ProjectDetailSummary view={view} />
              <ProjectDetailLastTurn projectId={project.id} />
            </>
          )}
          {current === "requirements" && <ProjectDetailRequirements view={view} />}
          {current === "traceability" && <ProjectDetailTraceability view={view} />}
          {current === "screens" && <ProjectDetailScreens view={view} />}
          {current === "worktrees" && project.repoPath && <ProjectDetailWorktrees projectId={project.id} />}
          {current === "activity" && <ProjectDetailActivity projectId={project.id} />}
          {current === "tests" && <ProjectDetailTests view={view} />}
          {current === "rules" && <ProjectDetailRules view={view} />}
          {current === "skills" && <ProjectDetailSkills view={view} />}
          {current === "context" && <ProjectDetailContext view={view} />}
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
