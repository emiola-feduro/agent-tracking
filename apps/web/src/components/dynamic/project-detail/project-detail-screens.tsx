import { PROJECT_KIND_INFO } from "@agent-tracking/core";
import { useState } from "react";
import AttachmentDrop from "@/components/dynamic/attachments/attachment-drop";
import AttachmentLightbox from "@/components/dynamic/attachments/attachment-lightbox";
import RemoveButton from "@/components/ui/remove-button/remove-button";
import TextField from "@/components/ui/text-field/text-field";
import useProjectActions from "@/hooks/data/use-project-actions";
import type { Attachment, ProjectView } from "@/lib/api";
import { formatRelative } from "@/lib/activity";
import { attachmentUrl } from "@/lib/attachments";
import { actorLabel } from "@/lib/labels";

/**
 * Gallery of the app's views: screenshots uploaded here or reported by agents with report_screen,
 * grouped by the requirement and feature they belong to.
 */
const ProjectDetailScreens = ({ view }: { view: ProjectView }) => {
  const { project, attachments, features, requirements } = view;
  const { uploadImages, deleteImage } = useProjectActions(project.id);
  const screens = attachments.filter((a) => a.kind === "screen").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [title, setTitle] = useState("");
  const [route, setRoute] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const hasUi = PROJECT_KIND_INFO[project.kind ?? "fullstack"].ui;

  const groupOf = (a: Attachment) => {
    const feature = features.find((f) => f.id === a.featureId);
    const requirement = feature && requirements.find((r) => r.id === feature.requirementId);
    return feature ? `${requirement ? `${requirement.title} / ` : ""}${feature.name}` : "Sin feature";
  };
  const groups = [...new Set(screens.map(groupOf))].sort((a, b) => (a === "Sin feature" ? 1 : b === "Sin feature" ? -1 : a.localeCompare(b)));

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:p-5">
        <div>
          <h2 className="font-semibold text-ink">Vistas de la app</h2>
          <p className="text-sm text-muted">
            {hasUi ? "Una captura por pantalla." : "Este tipo de proyecto no suele tener interfaz, pero puedes guardar capturas igual."} Los agentes
            agregan las suyas con la herramienta <code className="font-mono text-ink-soft">report_screen</code> al terminar una vista.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Nombre de la vista" value={title} onChange={setTitle} placeholder="Lista de gastos" />
          <TextField label="Ruta o ubicación" value={route} onChange={setRoute} placeholder="/gastos" spellCheck={false} />
        </div>
        <AttachmentDrop
          label="Agregar capturas"
          busy={uploadImages.isPending}
          onFiles={(files) =>
            uploadImages.mutate(
              { files, kind: "screen", title: title.trim() || undefined, route: route.trim() || undefined },
              { onSuccess: () => (setTitle(""), setRoute("")) },
            )
          }
        />
        {uploadImages.isError && <p className="text-xs text-danger">{(uploadImages.error as Error).message}</p>}
      </section>

      {screens.length === 0 && <p className="text-muted">Todavía no hay vistas guardadas.</p>}
      {groups.map((group) => (
        <section key={group} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink-soft">{group}</h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {screens
              .filter((s) => groupOf(s) === group)
              .map((screen) => (
                <li key={screen.id} className="group flex animate-enter flex-col overflow-hidden rounded-lg border border-line bg-surface">
                  <button
                    type="button"
                    onClick={() => setOpen(screens.indexOf(screen))}
                    className="block aspect-[16/10] overflow-hidden border-b border-line bg-subtle"
                    aria-label={`Ver ${screen.title || screen.filename} en grande`}
                  >
                    <img
                      src={attachmentUrl(screen)}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </button>
                  <div className="flex items-start gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{screen.title || screen.filename}</p>
                      {screen.route && <code className="block truncate font-mono text-xs text-ink-soft">{screen.route}</code>}
                      <p className="text-xs text-muted">
                        {actorLabel(screen.createdBy)}, {formatRelative(screen.createdAt)}
                      </p>
                    </div>
                    <RemoveButton label={`Quitar ${screen.title || screen.filename}`} onClick={() => confirm("Quitar esta vista de la galería.") && deleteImage.mutate(screen.id)} />
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
      <AttachmentLightbox images={screens} index={open} onIndex={setOpen} />
    </div>
  );
};

export default ProjectDetailScreens;
