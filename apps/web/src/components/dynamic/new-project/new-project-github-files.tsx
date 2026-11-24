import CheckOption from "@/components/ui/check-option/check-option";
import type { GithubFileKind } from "@/lib/api";
import { GITHUB_FILE_LABELS } from "@/lib/labels";
import useWizardStore from "@/stores/use-wizard-store";

const OPTIONS: { kind: GithubFileKind; path: string; description: string }[] = [
  {
    kind: "ci",
    path: ".github/workflows/ci.yml",
    description: "GitHub Actions instala, corre los tests y compila en cada push y pull request. Se arma según el stack que elijas.",
  },
  {
    kind: "prTemplate",
    path: ".github/pull_request_template.md",
    description: "Cada pull request pide el requerimiento, el checklist del Definition of Done y cómo probarlo.",
  },
];

/** Starter `.github` files written when the project is created. Files that already exist are kept. */
const NewProjectGithubFiles = () => {
  const selected = useWizardStore((s) => s.githubFiles);
  const toggle = useWizardStore((s) => s.toggleGithubFile);

  return (
    <fieldset className="flex animate-enter flex-col gap-2">
      <legend className="mb-1 font-semibold text-ink">Carpeta .github</legend>
      <p className="mb-1 text-sm text-ink-soft">Se crean al guardar el proyecto. Si ya existen en el repositorio, no se tocan.</p>
      {OPTIONS.map(({ kind, path, description }) => (
        <CheckOption
          key={kind}
          checked={selected.includes(kind)}
          onChange={() => toggle(kind)}
          label={GITHUB_FILE_LABELS[kind]}
          meta={<code className="font-mono text-xs font-normal text-muted">{path}</code>}
          description={description}
        />
      ))}
    </fieldset>
  );
};

export default NewProjectGithubFiles;
