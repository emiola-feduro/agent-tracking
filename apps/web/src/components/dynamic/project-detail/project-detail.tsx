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
import ProjectDetailRequirements from "./project-detail-requirements";
import ProjectDetailRules from "./project-detail-rules";
import ProjectDetailScreens from "./project-detail-screens";
import ProjectDetailWorktrees from "./project-detail-worktrees";
import ProjectDetailSkills from "./project-detail-skills";
import ProjectDetailSummary from "./project-detail-summary";
import ProjectDetailTests from "./project-detail-tests";
import ProjectDetailTraceability from "./project-detail-traceability";

export type GithubTab = "pulls" | "branches" | "pipelines";
export type ProjectTab = "requirements" | "traceability" | "screens" | "worktrees" | "activity" | "tests" | GithubTab | "rules" | "skills" | "context";

type ProjectDetailProps = {
  view: ProjectView;
  tab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
};

const ProjectDetail = ({ view, tab, onTabChange }: ProjectDetailProps) => {
  const { requirements, rules, skills, tests, attachments, project } = view;
  const screens = attachments.filter((a) => a.kind === "screen").length;
  const items: { value: ProjectTab; label: string }[] = [
    { value: "requirements", label: `Requerimientos (${requirements.length})` },
    { value: "traceability", label: "Trazabilidad" },
    { value: "screens", label: screens ? `Vistas (${screens})` : "Vistas" },
    ...(project.repoPath ? [{ value: "worktrees" as const, label: "Ramas y worktrees" }] : []),
    { value: "activity", label: "Actividad" },
    { value: "tests", label: `Tests (${tests.length})` },
    { value: "pulls", label: "Pull requests" },
    { value: "branches", label: "Ramas en GitHub" },
    { value: "pipelines", label: "Pipelines" },
    { value: "rules", label: `Reglas (${rules.length})` },
    { value: "skills", label: `Skills (${skills.filter((k) => k.enabled).length})` },
    { value: "context", label: "Contexto" },
  ];

  return (
    <div className="flex animate-enter flex-col gap-6">
      <ProjectDetailSummary view={view} />
      <ProjectDetailLive view={view} />
      <ProjectDetailLastTurn projectId={view.project.id} />
      <div className="flex flex-col gap-4">
        <Tabs label="Secciones del proyecto" items={items} value={tab} onChange={onTabChange} />
        <div key={tab} className="animate-enter" role="tabpanel">
          {tab === "requirements" && <ProjectDetailRequirements view={view} />}
          {tab === "traceability" && <ProjectDetailTraceability view={view} />}
          {tab === "screens" && <ProjectDetailScreens view={view} />}
          {tab === "worktrees" && project.repoPath && <ProjectDetailWorktrees projectId={project.id} />}
          {tab === "activity" && <ProjectDetailActivity projectId={view.project.id} />}
          {tab === "tests" && <ProjectDetailTests view={view} />}
          {tab === "rules" && <ProjectDetailRules view={view} />}
          {tab === "skills" && <ProjectDetailSkills view={view} />}
          {tab === "context" && <ProjectDetailContext view={view} />}
          {(tab === "pulls" || tab === "branches" || tab === "pipelines") && (
            <GithubPanel project={view.project}>
              {tab === "pulls" && <GithubPulls projectId={view.project.id} />}
              {tab === "branches" && <GithubBranches projectId={view.project.id} />}
              {tab === "pipelines" && <GithubPipelines projectId={view.project.id} />}
            </GithubPanel>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
