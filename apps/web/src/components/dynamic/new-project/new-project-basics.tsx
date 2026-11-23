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
  const platforms = useWizardStore((s) => s.platforms);
  const repoUrl = useWizardStore((s) => s.repoUrl);
  const hasLocalRepo = useWizardStore((s) => s.repo !== null);
  const patch = useWizardStore((s) => s.patch);
  const togglePlatform = useWizardStore((s) => s.togglePlatform);

  return (
    <div className="flex flex-col gap-6">
      <TextField label="Nombre del proyecto" value={name} onChange={(v) => patch({ name: v })} placeholder="Tienda en línea" />
      <fieldset className="flex flex-col gap-2">
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
