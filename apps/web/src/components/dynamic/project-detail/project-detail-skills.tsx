import Button from "@/components/ui/button/button";
import RemoveButton from "@/components/ui/remove-button/remove-button";
import StatusPill from "@/components/ui/status-pill/status-pill";
import useProjectActions from "@/hooks/data/use-project-actions";
import { useSkillActions, useSkillStatus } from "@/hooks/data/use-skill-status";
import type { ProjectView } from "@/lib/api";

const SOURCE_LABEL: Record<string, string> = {
  user: "Personal",
  repo: "En el repo",
  plugin: "Plugin",
  catalog: "Catálogo",
  created: "Creada",
};

/**
 * Skills of the project and whether this machine has them. Personal skills can be copied into the
 * repo for collaborators; plugin skills are installed from their marketplace with Claude Code.
 */
const ProjectDetailSkills = ({ view }: { view: ProjectView }) => {
  const { project, skills } = view;
  const { toggleSkill, removeSkill } = useProjectActions(project.id);
  const { data: status } = useSkillStatus(project.id);
  const { install, share } = useSkillActions(project.id);
  const missing = (status ?? []).filter((x) => !x.installed).length;

  return (
    <div className="flex flex-col gap-3">
      {missing > 0 && (
        <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
          {missing === 1 ? "Falta 1 skill" : `Faltan ${missing} skills`} en este equipo. Los agentes no las van a usar hasta que las instales.
        </p>
      )}
      {(install.isError || share.isError) && (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{((install.error ?? share.error) as Error).message}</p>
      )}
      <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
        {skills.length === 0 && <li className="p-4 text-muted">Este proyecto no tiene skills seleccionadas.</li>}
        {skills.map((skill) => {
          const { id, name, description, source, enabled, plugin, marketplace, shared } = skill;
          const here = status?.find((x) => x.skillId === id);
          const canShare = (source === "user" || source === "created") && !plugin;
          return (
            <li key={id} className="flex flex-col gap-2 p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => toggleSkill.mutate({ skillId: id, enabled: !enabled })}
                  aria-label={`Usar ${name} en este proyecto`}
                  className="mt-1 size-4 shrink-0 accent-brand"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{name}</span>
                    <StatusPill>{SOURCE_LABEL[source] ?? source}</StatusPill>
                    {plugin && (
                      <code className="font-mono text-xs text-muted">
                        {plugin}
                        {marketplace ? `@${marketplace}` : ""}
                      </code>
                    )}
                    {here &&
                      (here.installed ? (
                        <StatusPill tone="ok">Instalada aquí</StatusPill>
                      ) : (
                        <StatusPill tone="warn">No está en este equipo</StatusPill>
                      ))}
                  </div>
                  {description && <p className="line-clamp-2 text-sm text-muted">{description}</p>}
                </div>
                <RemoveButton label={`Quitar skill ${name}`} onClick={() => removeSkill.mutate(id)} />
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-7">
                {here && !here.installed && here.install && (
                  <Button
                    size="sm"
                    variant="primary"
                    isLoading={install.isPending && install.variables === id}
                    onClick={() => {
                      const what =
                        here.install === "shared"
                          ? `Copiar la skill ${name} del repo a tu carpeta de skills de Claude Code.`
                          : `Instalar el plugin con Claude Code:\n\n${here.commands?.join("\n")}`;
                      if (confirm(what)) install.mutate(id);
                    }}
                  >
                    {here.install === "shared" ? "Instalar desde el repo" : "Instalar plugin"}
                  </Button>
                )}
                {here && !here.installed && !here.install && (
                  <span className="text-sm text-muted">Pídela a quien la agregó, o márcala como compartida en su equipo.</span>
                )}
                {canShare && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      checked={shared}
                      onChange={() => share.mutate({ skillId: id, shared: !shared })}
                      className="size-4 accent-brand"
                    />
                    Incluirla en el repo para que otros la instalen
                  </label>
                )}
              </div>
              {here?.install === "plugin" && here.commands && (
                <pre className="ml-7 overflow-x-auto rounded-md bg-subtle px-3 py-2 font-mono text-xs text-ink-soft">{here.commands.join("\n")}</pre>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">
        Al incluir una skill se copia a <code className="font-mono">.agent-tracking/skills</code>, sin archivos ocultos. Revísala antes de subirla si
        el repo es público.
      </p>
    </div>
  );
};

export default ProjectDetailSkills;
