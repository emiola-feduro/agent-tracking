import { PROJECT_KIND_INFO, PROJECT_KINDS } from "@agent-tracking/core";
import CheckOption from "@/components/ui/check-option/check-option";
import ChoiceCard from "@/components/ui/choice-card/choice-card";
import TextField from "@/components/ui/text-field/text-field";
import type { AgentKind, Platform } from "@/lib/api";
import useWizardStore from "@/stores/use-wizard-store";
import NewProjectParts from "./new-project-parts";

const PLATFORM_CHOICES: { id: Platform; title: string; description: string }[] = [
  { id: "web", title: "Web", description: "Se usa desde el navegador" },
  { id: "desktop", title: "Escritorio", description: "Windows, macOS o Linux" },
  { id: "mobile", title: "Móvil", description: "iOS y Android" },
];

const AGENT_CHOICES: { kind: AgentKind; label: string; file: string }[] = [
  { kind: "claude-code", label: "Claude Code", file: "CLAUDE.md" },
  { kind: "codex", label: "Codex CLI", file: "AGENTS.md" },
  { kind: "gemini-cli", label: "Gemini CLI", file: "GEMINI.md" },
];

const NewProjectBasics = () => {
  const name = useWizardStore((s) => s.name);
  const kind = useWizardStore((s) => s.kind);
  const platforms = useWizardStore((s) => s.platforms);
  const repoUrl = useWizardStore((s) => s.repoUrl);
  const agents = useWizardStore((s) => s.agents);
  const hasLocalRepo = useWizardStore((s) => s.repo !== null);
  const patch = useWizardStore((s) => s.patch);
  const setKind = useWizardStore((s) => s.setKind);
  const togglePlatform = useWizardStore((s) => s.togglePlatform);
  const structure = useWizardStore((s) => s.structure);
  const setStructure = useWizardStore((s) => s.setStructure);

  return (
    <div className="flex flex-col gap-6">
      <TextField label="Nombre del proyecto" value={name} onChange={(v) => patch({ name: v })} placeholder="Tienda en línea" />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">Estructura del repositorio</legend>
        <div role="radiogroup" aria-label="Estructura del repositorio" className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            mode="radio"
            title="Una sola app"
            description="Todo el código en un proyecto: una web, una API, una app móvil o multiplataforma"
            selected={structure === "single"}
            onSelect={() => setStructure("single")}
          />
          <ChoiceCard
            mode="radio"
            title="Monorepo"
            description="Varias piezas en un repositorio: por ejemplo app móvil, API, panel web y una librería compartida"
            selected={structure === "monorepo"}
            onSelect={() => setStructure("monorepo")}
          />
        </div>
      </fieldset>
      {structure === "monorepo" ? (
        <NewProjectParts />
      ) : (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink">Tipo de proyecto</legend>
            <p className="mb-2 text-sm text-muted">Decide qué partes del stack aplican: una API no lleva interfaz, una librería no lleva servidor.</p>
            <div role="radiogroup" aria-label="Tipo de proyecto" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PROJECT_KINDS.map((id) => (
                <ChoiceCard
                  key={id}
                  mode="radio"
                  title={PROJECT_KIND_INFO[id].label}
                  description={PROJECT_KIND_INFO[id].description}
                  selected={kind === id}
                  onSelect={() => setKind(id)}
                />
              ))}
            </div>
          </fieldset>
          {PROJECT_KIND_INFO[kind].platforms === null && (
            <fieldset className="flex animate-enter flex-col gap-2">
              <legend className="mb-2 text-sm font-medium text-ink">Plataformas (puedes elegir varias)</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {PLATFORM_CHOICES.map(({ id, title, description }) => (
                  <ChoiceCard
                    key={id}
                    title={title}
                    description={description}
                    selected={platforms.includes(id)}
                    onSelect={() => togglePlatform(id)}
                  />
                ))}
              </div>
            </fieldset>
          )}
        </>
      )}
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium text-ink">Agentes que van a trabajar en el proyecto</legend>
        <p className="mb-1 text-sm text-muted">
          {hasLocalRepo
            ? "A cada uno se le deja, en su archivo de instrucciones del repositorio, cómo leer el contexto y reportar."
            : "Elige un repositorio en Origen para dejarles instrucciones en el repo."}
        </p>
        <div className="grid gap-x-4 sm:grid-cols-3">
          {AGENT_CHOICES.map(({ kind, label, file }) => (
            <CheckOption
              key={kind}
              checked={agents.includes(kind)}
              onChange={() => patch({ agents: agents.includes(kind) ? agents.filter((a) => a !== kind) : [...agents, kind] })}
              label={label}
              meta={<code className="font-mono text-xs font-normal text-muted">{file}</code>}
            />
          ))}
        </div>
      </fieldset>
      <TextField
        label="Repositorio en GitHub"
        type="url"
        value={repoUrl}
        onChange={(v) => patch({ repoUrl: v })}
        placeholder="https://github.com/organizacion/repositorio"
        hint={hasLocalRepo ? undefined : "Opcional. Vincula el proyecto sin clonarlo."}
        spellCheck={false}
      />
    </div>
  );
};

export default NewProjectBasics;
