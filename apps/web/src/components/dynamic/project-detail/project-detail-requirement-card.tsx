import type { Requirement } from "@agent-tracking/core";
import AttachmentDrop from "@/components/dynamic/attachments/attachment-drop";
import AttachmentThumbs from "@/components/dynamic/attachments/attachment-thumbs";
import ProgressBar from "@/components/ui/progress-bar/progress-bar";
import RemoveButton from "@/components/ui/remove-button/remove-button";
import useProjectActions from "@/hooks/data/use-project-actions";
import type { ProjectView, RequirementArea, RequirementType } from "@/lib/api";
import { REQUIREMENT_AREA_OPTIONS, REQUIREMENT_TYPE_OPTIONS } from "@/lib/labels";
import ProjectDetailDod from "./project-detail-dod";
import ProjectDetailFeatures from "./project-detail-features";

type ProjectDetailRequirementCardProps = {
  requirement: Requirement;
  view: ProjectView;
};

/** A compact select styled as a pill, to change type or area in place. */
const PillSelect = <T extends string>({
  label,
  value,
  options,
  onChange,
  tone,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  tone: string;
}) => (
  <label className={`relative inline-flex items-center rounded-full text-xs font-medium ${tone}`}>
    <span className="sr-only">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="cursor-pointer appearance-none rounded-full bg-transparent py-0.5 pr-6 pl-2.5 outline-offset-2 [field-sizing:content]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="pointer-events-none absolute right-1.5 size-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  </label>
);

const ProjectDetailRequirementCard = ({ requirement, view }: ProjectDetailRequirementCardProps) => {
  const { id, title, description, type, area } = requirement;
  const { project, progress, dod, features, attachments } = view;
  const { deleteRequirement, updateRequirement, uploadImages, deleteImage } = useProjectActions(project.id);
  const references = attachments.filter((a) => a.kind === "reference" && a.requirementId === id && !a.dodItemId);

  const remove = () => {
    if (confirm(`Eliminar el requerimiento "${title}" y su Definition of Done. No se puede deshacer.`)) {
      deleteRequirement.mutate(id);
    }
  };

  return (
    <article className="flex animate-enter flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <PillSelect<RequirementType>
              label={`Tipo de ${title}`}
              value={type}
              options={REQUIREMENT_TYPE_OPTIONS}
              onChange={(v) => updateRequirement.mutate({ reqId: id, type: v })}
              tone={type === "functional" ? "bg-brand-soft text-brand" : "bg-warn-soft text-warn"}
            />
            <PillSelect<RequirementArea>
              label={`Área de ${title}`}
              value={area}
              options={REQUIREMENT_AREA_OPTIONS}
              onChange={(v) => updateRequirement.mutate({ reqId: id, area: v })}
              tone="bg-subtle text-ink-soft"
            />
          </div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
        </div>
        <RemoveButton label={`Eliminar ${title}`} onClick={remove} />
      </div>
      {description && <p className="-mt-2 max-w-[70ch] text-ink-soft">{description}</p>}
      <ProgressBar value={progress.requirements[id] ?? 0} label={`Avance de ${title}`} />
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">
          Referencias visuales {references.length > 0 && <span className="font-normal text-muted">({references.length})</span>}
        </h3>
        <p className="-mt-1 text-xs text-muted">Cómo debería verse. Los agentes las reciben en CONTEXT.md.</p>
        <AttachmentThumbs images={references} onDelete={(a) => deleteImage.mutate(a.id)} />
        <AttachmentDrop
          busy={uploadImages.isPending && uploadImages.variables?.requirementId === id && !uploadImages.variables?.dodItemId}
          onFiles={(files) => uploadImages.mutate({ files, requirementId: id })}
          label="Agregar una referencia"
        />
        {uploadImages.isError && <p className="text-xs text-danger">{(uploadImages.error as Error).message}</p>}
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        <ProjectDetailDod
          projectId={project.id}
          requirementId={id}
          items={dod.filter((d) => d.requirementId === id)}
          images={attachments.filter((a) => a.kind === "reference" && a.dodItemId)}
        />
        <ProjectDetailFeatures features={features.filter((f) => f.requirementId === id)} progress={progress.features} />
      </div>
    </article>
  );
};

export default ProjectDetailRequirementCard;
