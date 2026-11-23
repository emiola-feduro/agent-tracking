import CheckOption from "@/components/ui/check-option/check-option";
import RemoveButton from "@/components/ui/remove-button/remove-button";
import StatusPill from "@/components/ui/status-pill/status-pill";
import useProjectActions from "@/hooks/data/use-project-actions";
import type { ProjectView } from "@/lib/api";

const ProjectDetailSkills = ({ view }: { view: ProjectView }) => {
  const { project, skills } = view;
  const { toggleSkill, removeSkill } = useProjectActions(project.id);

  return (
    <section className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-3">
      {skills.length === 0 && <p className="p-2 text-muted">Este proyecto no tiene skills seleccionadas.</p>}
      {skills.map(({ id, name, description, source, enabled }) => (
        <div key={id} className="flex items-start gap-1">
          <div className="flex-1">
            <CheckOption
              checked={enabled}
              onChange={() => toggleSkill.mutate({ skillId: id, enabled: !enabled })}
              label={name}
              meta={<StatusPill>{source}</StatusPill>}
              description={description}
            />
          </div>
          <RemoveButton label={`Quitar skill ${name}`} onClick={() => removeSkill.mutate(id)} />
        </div>
      ))}
    </section>
  );
};

export default ProjectDetailSkills;
