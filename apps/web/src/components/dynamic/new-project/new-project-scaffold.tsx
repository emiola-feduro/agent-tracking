import { partPlatforms, proposedTree, recommendMonorepoTool } from "@agent-tracking/core";
import CheckOption from "@/components/ui/check-option/check-option";
import useWizardStore, { projectShape } from "@/stores/use-wizard-store";

/**
 * The folders the repository starts with, drawn as a tree, and whether to create them: a README and
 * the manifest of each piece, plus the files of the monorepo tool. Existing files are never replaced.
 */
const NewProjectScaffold = () => {
  const s = useWizardStore();
  const monorepo = s.structure === "monorepo";
  const shape = projectShape(s);
  const parts = monorepo
    ? s.parts.map((p) => ({ ...p, platforms: partPlatforms(p) }))
    : [{ id: "root", name: s.name || "proyecto", kind: shape.kind, platforms: shape.platforms, path: ".", stack: shape.stack }];
  const tool = monorepo ? (s.monorepoTool ?? recommendMonorepoTool(parts)) : null;
  const tree = proposedTree({ name: s.name || "proyecto", structure: s.structure, parts, tool });

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="font-semibold text-ink">Estructura de carpetas</h3>
        <p className="text-sm text-muted">
          {monorepo ? "Cada pieza en su carpeta, con su README y su manifiesto." : "El README y el manifiesto del proyecto en la raíz."}
        </p>
      </div>
      <pre
        className="overflow-x-auto rounded-md border border-line bg-subtle p-4 font-mono text-[0.8125rem] leading-6 text-ink"
        aria-label="Árbol de carpetas propuesto"
      >
        {tree}
      </pre>
      {s.repo ? (
        <CheckOption
          checked={s.scaffold}
          onChange={() => s.patch({ scaffold: !s.scaffold })}
          label="Crear esta estructura en el repositorio"
          meta={<span className="text-sm font-normal text-muted">no reemplaza archivos que ya existan</span>}
        />
      ) : (
        <p className="text-sm text-muted">Elige un repositorio en Origen para crear estas carpetas.</p>
      )}
    </section>
  );
};

export default NewProjectScaffold;
