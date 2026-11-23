import GithubBranches from "@/components/dynamic/github-branches/github-branches";
import GithubPanel from "@/components/dynamic/github-panel/github-panel";
import GithubPipelines from "@/components/dynamic/github-pipelines/github-pipelines";
import GithubPulls from "@/components/dynamic/github-pulls/github-pulls";
import Tabs from "@/components/ui/tabs/tabs";
import type { ProjectView } from "@/lib/api";
import ProjectDetailContext from "./project-detail-context";
import ProjectDetailRequirements from "./project-detail-requirements";
import ProjectDetailRules from "./project-detail-rules";
import ProjectDetailSkills from "./project-detail-skills";
import ProjectDetailSummary from "./project-detail-summary";

export type ProjectTab = "requirements" | "rules" | "skills" | "context" | GithubTab;
export type GithubTab = "pulls" | "branches" | "pipelines";

type ProjectDetailProps = {
  view: ProjectView;
  tab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
};

const ProjectDetail = ({ view, tab, onTabChange }: ProjectDetailProps) => {
  const { requirements, rules, skills } = view;
  const items: { value: ProjectTab; label: string }[] = [
    { value: "requirements", label: `Requerimientos (${requirements.length})` },
    { value: "rules", label: `Reglas (${rules.length})` },
    { value: "skills", label: `Skills (${skills.filter((k) => k.enabled).length})` },
    { value: "context", label: "Contexto" },
    { value: "pulls", label: "Pull requests" },
    { value: "branches", label: "Ramas" },
    { value: "pipelines", label: "Pipelines" },
  ];

  return (
    <div className="flex animate-enter flex-col gap-6">
      <ProjectDetailSummary view={view} />
      <div className="flex flex-col gap-4">
        <Tabs label="Secciones del proyecto" items={items} value={tab} onChange={onTabChange} />
        <div key={tab} className="animate-enter" role="tabpanel">
          {tab === "requirements" && <ProjectDetailRequirements view={view} />}
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
