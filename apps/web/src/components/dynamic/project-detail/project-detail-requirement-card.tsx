import { useState } from "react";
import LaunchAgentDialog from "@/components/dynamic/agent-runs/launch-agent-dialog";
import Button from "@/components/ui/button/button";
import PartChips from "@/components/dynamic/requirement-parts/part-chips";
import { REQUIREMENT_AREA_LABEL, REQUIREMENT_TYPE_LABEL, requirementLabel } from "@agent-tracking/core";
import AttachmentDrop from "@/components/dynamic/attachments/attachment-drop";
import AttachmentThumbs from "@/components/dynamic/attachments/attachment-thumbs";
import ProgressBar from "@/components/ui/progress-bar/progress-bar";
import RemoveButton from "@/components/ui/remove-button/remove-button";
import useProjectActions from "@/hooks/data/use-project-actions";
import type { ProjectView, Requirement } from "@/lib/api";
import ProjectDetailDod from "./project-detail-dod";
import ProjectDetailFeatures from "./project-detail-features";
import ProjectDetailRequirementClassification from "./project-detail-requirement-classification";
import ProjectDetailRequirementCode from "./project-detail-requirement-code";

type ProjectDetailRequirementCardProps = {
  requirement: Requirement;
  view: ProjectView;
  open: boolean;
  onToggle: () => void;
};

/** Folded: one line with what matters (classification, progress, criteria). Open: everything. */
const ProjectDetailRequirementCard = ({ requirement, view, open, onToggle }: ProjectDetailRequirementCardProps) => {
  const { id, title, description, type, area } = requirement;
  const { project, progress, dod, features, attachments } = view;
  const { deleteRequirement, updateRequirement, uploadImages, deleteImage } = useProjectActions(project.id);
  const references = attachments.filter((a) => a.kind === "reference" && a.requirementId === id && !a.dodItemId);
  const items = dod.filter((d) => d.requirementId === id);
  const done = items.filter((d) => d.status === "done").length;
  const own = features.filter((f) => f.requirementId === id);
  const images = attachments.filter((a) => a.kind === "reference" && a.requirementId === id).length;
  const percent = progress.requirements[id] ?? 0;
  const panelId = `requirement-${id}`;
  const [launching, setLaunching] = useState(false);

  const remove = () => {
    if (confirm(`Eliminar el requerimiento "${requirementLabel(requirement)}" y su Definition of Done. No se puede deshacer.`)) deleteRequirement.mutate(id);
  };

  return (
    <article
      className={`animate-enter overflow-hidden rounded-lg border bg-surface transition-colors duration-150 ${open ? "border-line-strong" : "border-line"}`}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-w-0 flex-1 flex-col gap-2 px-4 py-3 text-left transition-colors duration-150 hover:bg-subtle sm:flex-row sm:items-center sm:gap-4 sm:px-5"
        >
          <span className="flex min-w-0 flex-1 items-start gap-3">
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className={`mt-1 size-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="m6 4 4 4-4 4" />
            </svg>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-semibold text-ink">
                {requirement.code && <span className="mr-2 font-mono text-[0.8125rem] font-medium text-brand">{requirement.code}</span>}
                {title}
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${type === "functional" ? "bg-brand-soft text-brand" : "bg-warn-soft text-warn"}`}
                >
                  {REQUIREMENT_TYPE_LABEL[type]}
                </span>
                <span className="rounded-full bg-subtle px-2 py-0.5 text-ink-soft">{REQUIREMENT_AREA_LABEL[area]}</span>
                <span className="text-muted tabular-nums">
                  {items.length ? `${done} de ${items.length} ${items.length === 1 ? "criterio" : "criterios"}` : "Sin criterios"}
                  {own.length > 0 && `, ${own.length === 1 ? "1 feature" : `${own.length} features`}`}
                  {images > 0 && `, ${images === 1 ? "1 imagen" : `${images} imágenes`}`}
                </span>
              </span>
            </span>
          </span>
          <span className="w-full pl-7 sm:w-44 sm:pl-0">
            <ProgressBar value={percent} label={`Avance de ${title}`} />
          </span>
        </button>
        <div className="flex items-start px-2 pt-2.5">
          <RemoveButton label={`Eliminar ${title}`} onClick={remove} />
        </div>
      </div>

      {open && (
        <div id={panelId} className="flex animate-enter flex-col gap-5 border-t border-line px-4 py-4 sm:px-5">
          {description && <p className="max-w-[70ch] text-ink-soft">{description}</p>}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ProjectDetailRequirementCode requirement={requirement} view={view} />
            <Button variant="primary" onClick={() => setLaunching(true)} disabled={!project.repoPath}>
              Implementar con un agente
            </Button>
          </div>
          <LaunchAgentDialog projectId={project.id} requirement={launching ? requirement : null} onClose={() => setLaunching(false)} />
          <ProjectDetailRequirementClassification
            requirement={requirement}
            kind={project.kind ?? "fullstack"}
            onChange={(change) => updateRequirement.mutate({ reqId: id, ...change })}
          />
          {project.structure === "monorepo" && (
            <PartChips
              parts={project.parts ?? []}
              value={requirement.parts ?? []}
              onChange={(parts) => updateRequirement.mutate({ reqId: id, parts })}
            />
          )}
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
              items={items}
              images={attachments.filter((a) => a.kind === "reference" && a.dodItemId)}
            />
            <ProjectDetailFeatures features={own} progress={progress.features} />
          </div>
        </div>
      )}
    </article>
  );
};

export default ProjectDetailRequirementCard;
