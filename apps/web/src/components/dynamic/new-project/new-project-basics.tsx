import { PROJECT_KIND_INFO, PROJECT_KINDS } from "@agent-tracking/core";
import ChoiceCard from "@/components/ui/choice-card/choice-card";
import TextField from "@/components/ui/text-field/text-field";
import type { Platform } from "@/lib/api";
import useWizardStore from "@/stores/use-wizard-store";

const PLATFORM_CHOICES: { id: Platform; title: string; description: string }[] = [
  { id: "web", title: "Web", description: "Se usa desde el navegador" },
  { id: "desktop", title: "Escritorio", description: "Windows, macOS o Linux" },
  { id: "mobile", title: "Móvil", description: "iOS y Android" },
];

const NewProjectBasics = () => {
  const name = useWizardStore((s) => s.name);
  const kind = useWizardStore((s) => s.kind);
  const platforms = useWizardStore((s) => s.platforms);
  const repoUrl = useWizardStore((s) => s.repoUrl);
  const hasLocalRepo = useWizardStore((s) => s.repo !== null);
  const patch = useWizardStore((s) => s.patch);
  const setKind = useWizardStore((s) => s.setKind);
  const togglePlatform = useWizardStore((s) => s.togglePlatform);

  return (
    <div className="flex flex-col gap-6">
      <TextField label="Nombre del proyecto" value={name} onChange={(v) => patch({ name: v })} placeholder="Tienda en línea" />
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
