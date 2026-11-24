import type { ProjectView } from "@/lib/api";
import ProjectDetailTestIdeaForm from "./project-detail-test-idea-form";
import ProjectDetailTestIdeaItem from "./project-detail-test-idea-item";

const ProjectDetailTestIdeas = ({ view }: { view: ProjectView }) => {
  const { project, testIdeas, requirements, features } = view;
  const requirementTitle = new Map(requirements.map((r) => [r.id, r.title]));
  const featureName = new Map(features.map((f) => [f.id, f.name]));
  // Open ideas first; discarded ones sink to the bottom.
  const ideas = [...testIdeas].sort((a, b) => Number(a.status === "discarded") - Number(b.status === "discarded"));

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <h2 className="font-semibold text-ink">Ideas de tests ({testIdeas.length})</h2>
      {ideas.length === 0 && <p className="text-sm text-muted">Sin ideas todavía.</p>}
      <ul className="flex flex-col divide-y divide-line">
        {ideas.map((idea) => (
          <ProjectDetailTestIdeaItem
            key={idea.id}
            projectId={project.id}
            idea={idea}
            target={(idea.featureId && featureName.get(idea.featureId)) || (idea.requirementId && requirementTitle.get(idea.requirementId)) || null}
          />
        ))}
      </ul>
      <ProjectDetailTestIdeaForm projectId={project.id} requirements={requirements} />
    </section>
  );
};

export default ProjectDetailTestIdeas;
