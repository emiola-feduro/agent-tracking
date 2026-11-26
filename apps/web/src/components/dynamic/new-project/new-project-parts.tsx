import { partPathProblem, partsProblems, PROJECT_KIND_INFO, PROJECT_KINDS, type ProjectKind } from "@agent-tracking/core";
import Button from "@/components/ui/button/button";
import CheckOption from "@/components/ui/check-option/check-option";
import RemoveButton from "@/components/ui/remove-button/remove-button";
import SelectField from "@/components/ui/select-field/select-field";
import TextField from "@/components/ui/text-field/text-field";
import type { Platform } from "@/lib/api";
import useWizardStore from "@/stores/use-wizard-store";

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "web", label: "Web" },
  { id: "desktop", label: "Escritorio" },
  { id: "mobile", label: "Móvil" },
];

/** One click for the usual pieces of a monorepo. */
const PRESETS: { kind: ProjectKind; label: string }[] = [
  { kind: "mobile", label: "App móvil" },
  { kind: "frontend", label: "Web" },
  { kind: "api", label: "API" },
  { kind: "desktop", label: "Escritorio" },
  { kind: "app", label: "App multiplataforma" },
  { kind: "library", label: "Librería compartida" },
  { kind: "cli", label: "Herramienta de terminal" },
];

const KIND_OPTIONS = PROJECT_KINDS.filter((k) => k !== "fullstack").map((k) => ({ value: k, label: PROJECT_KIND_INFO[k].label }));

/**
 * The pieces of a monorepo: each one with a name, what it is, where it runs and its folder. The
 * folder follows the name until the person writes one; problems are shown before moving on.
 */
const NewProjectParts = () => {
  const parts = useWizardStore((s) => s.parts);
  const addPart = useWizardStore((s) => s.addPart);
  const updatePart = useWizardStore((s) => s.updatePart);
  const removePart = useWizardStore((s) => s.removePart);
  const problems = partsProblems(parts);

  return (
    <fieldset className="flex animate-enter flex-col gap-3">
      <legend className="mb-1 text-sm font-medium text-ink">Piezas del monorepo</legend>
      <p className="text-sm text-muted">
        Cada pieza vive en su carpeta y tiene su propio stack. Lo que comparten (tipos, componentes, lógica) va en una librería.
      </p>
      <ol className="flex flex-col gap-3">
        {parts.map((part, i) => {
          const pathProblem = part.path.trim() ? partPathProblem(part.path) : null;
          const fixed = PROJECT_KIND_INFO[part.kind].platforms;
          return (
            <li key={part.id} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
              <div className="flex items-start gap-3">
                <span aria-hidden className="mt-8 text-sm tabular-nums text-muted">
                  {i + 1}
                </span>
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-3">
                  <TextField label="Nombre" value={part.name} onChange={(name) => updatePart(part.id, { name })} placeholder="mobile" />
                  <SelectField
                    label="Tipo"
                    value={part.kind}
                    onChange={(kind) => updatePart(part.id, { kind: kind as ProjectKind })}
                    options={KIND_OPTIONS}
                  />
                  <TextField
                    label="Carpeta"
                    value={part.path}
                    onChange={(path) => updatePart(part.id, { path })}
                    placeholder="apps/mobile"
                    spellCheck={false}
                    autoComplete="off"
                    error={pathProblem ?? undefined}
                  />
                </div>
                <div className="mt-7">
                  <RemoveButton label={`Quitar la pieza ${part.name || i + 1}`} onClick={() => removePart(part.id)} />
                </div>
              </div>
              {fixed === null ? (
                <div className="flex flex-wrap items-center gap-x-4 pl-6">
                  <span className="text-sm text-ink-soft">Plataformas:</span>
                  {PLATFORMS.map((p) => (
                    <CheckOption
                      key={p.id}
                      checked={part.platforms.includes(p.id)}
                      onChange={() =>
                        updatePart(part.id, {
                          platforms: part.platforms.includes(p.id) ? part.platforms.filter((x) => x !== p.id) : [...part.platforms, p.id],
                        })
                      }
                      label={p.label}
                    />
                  ))}
                </div>
              ) : (
                <p className="pl-6 text-sm text-muted">{PROJECT_KIND_INFO[part.kind].description}.</p>
              )}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-soft">Agregar:</span>
        {PRESETS.map((p) => (
          <Button key={p.kind} size="sm" variant="secondary" onClick={() => addPart(p.kind)}>
            + {p.label}
          </Button>
        ))}
      </div>
      {problems.length > 0 && parts.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-sm text-warn" aria-live="polite">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </fieldset>
  );
};

export default NewProjectParts;
