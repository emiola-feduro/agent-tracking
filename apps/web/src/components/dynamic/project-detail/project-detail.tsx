import Tabs from "@/components/ui/tabs/tabs";
import type { ProjectView } from "@/lib/api";
import ProjectDetailActivity from "./project-detail-activity";
import ProjectDetailContext from "./project-detail-context";
import ProjectDetailRequirements from "./project-detail-requirements";
import ProjectDetailRules from "./project-detail-rules";
import ProjectDetailSkills from "./project-detail-skills";
import ProjectDetailSummary from "./project-detail-summary";
import ProjectDetailTests from "./project-detail-tests";
import ProjectDetailTraceability from "./project-detail-traceability";

export type ProjectTab = "requirements" | "traceability" | "activity" | "tests" | "rules" | "skills" | "context";

type ProjectDetailProps = {
  view: ProjectView;
  tab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
};

const ProjectDetail = ({ view, tab, onTabChange }: ProjectDetailProps) => {
  const { requirements, rules, skills, tests } = view;
  const items: { value: ProjectTab; label: string }[] = [
    { value: "requirements", label: `Requerimientos (${requirements.length})` },
    { value: "traceability", label: "Trazabilidad" },
    { value: "activity", label: "Actividad" },
    { value: "tests", label: `Tests (${tests.length})` },
    { value: "rules", label: `Reglas (${rules.length})` },
    { value: "skills", label: `Skills (${skills.filter((k) => k.enabled).length})` },
    { value: "context", label: "Contexto" },
  ];

  return (
    <div className="flex animate-enter flex-col gap-6">
      <ProjectDetailSummary view={view} />
      <div className="flex flex-col gap-4">
        <Tabs label="Secciones del proyecto" items={items} value={tab} onChange={onTabChange} />
        <div key={tab} className="animate-enter" role="tabpanel">
          {tab === "requirements" && <ProjectDetailRequirements view={view} />}
          {tab === "traceability" && <ProjectDetailTraceability view={view} />}
          {tab === "activity" && <ProjectDetailActivity projectId={view.project.id} />}
          {tab === "tests" && <ProjectDetailTests view={view} />}
          {tab === "rules" && <ProjectDetailRules view={view} />}
          {tab === "skills" && <ProjectDetailSkills view={view} />}
          {tab === "context" && <ProjectDetailContext view={view} />}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
