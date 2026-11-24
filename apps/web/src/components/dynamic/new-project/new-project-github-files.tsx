import { ciToolchainLabel, ciWorkflow, pullRequestTemplate } from "@agent-tracking/core";
import { useState } from "react";
import CheckOption from "@/components/ui/check-option/check-option";
import MarkdownPreview from "@/components/ui/markdown-preview/markdown-preview";
import Segmented from "@/components/ui/segmented/segmented";
import { GITHUB_FILE_LABELS } from "@/lib/labels";
import useWizardStore from "@/stores/use-wizard-store";

type Mode = "write" | "preview";

/**
 * Starter `.github` files, offered at the end of the wizard: by then the stack decides the CI
 * pipeline and the requirements feed the pull request template, which can be edited as Markdown.
 * Files that already exist in the repository are never replaced.
 */
const NewProjectGithubFiles = () => {
  const selected = useWizardStore((s) => s.githubFiles);
  const toggle = useWizardStore((s) => s.toggleGithubFile);
  const name = useWizardStore((s) => s.name);
  const stack = useWizardStore((s) => s.stack);
  const requirements = useWizardStore((s) => s.requirements);
  const edited = useWizardStore((s) => s.prTemplate);
  const patch = useWizardStore((s) => s.patch);
  const [mode, setMode] = useState<Mode>("write");

  const input = { name, stack, requirements: requirements.filter((r) => r.title.trim()) };
  const toolchain = ciToolchainLabel(stack);
  const generated = pullRequestTemplate(input);
  const template = edited ?? generated;

  return (
    <section aria-labelledby="github-files-title" className="flex flex-col gap-3 border-t border-line pt-6">
      <div>
        <h3 id="github-files-title" className="font-semibold text-ink">
          Carpeta .github
        </h3>
        <p className="text-sm text-ink-soft">Se escriben en el repositorio al crear el proyecto. Si ya existen, no se tocan.</p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-line p-1">
        <CheckOption
          checked={selected.includes("ci")}
          onChange={() => toggle("ci")}
          label={GITHUB_FILE_LABELS.ci}
          meta={<code className="font-mono text-xs font-normal text-muted">.github/workflows/ci.yml</code>}
          description={
            toolchain
              ? `GitHub Actions instala, corre los tests y compila en cada push y pull request, con los pasos de ${toolchain} según tu stack.`
              : "Tu stack no tiene una receta conocida: el archivo se crea con un paso de ejemplo para que agregues los tuyos."
          }
        />
        {selected.includes("ci") && (
          <details className="group mx-3 mb-2">
            <summary className="w-fit cursor-pointer rounded-sm text-sm font-medium text-brand hover:underline">Ver el archivo</summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-subtle p-3 font-mono text-[0.8125rem] text-ink">{ciWorkflow(input)}</pre>
          </details>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-line p-1">
        <CheckOption
          checked={selected.includes("prTemplate")}
          onChange={() => toggle("prTemplate")}
          label={GITHUB_FILE_LABELS.prTemplate}
          meta={<code className="font-mono text-xs font-normal text-muted">.github/pull_request_template.md</code>}
          description="El texto con el que empieza cada pull request. Escríbelo en Markdown; parte de tus requerimientos y del Definition of Done."
        />
        {selected.includes("prTemplate") && (
          <div className="mx-3 mb-3 flex animate-enter flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Segmented
                label="Plantilla de pull request"
                value={mode}
                onChange={setMode}
                items={[
                  { value: "write", label: "Escribir" },
                  { value: "preview", label: "Vista previa" },
                ]}
              />
              {edited !== null && edited !== generated && (
                <button type="button" onClick={() => patch({ prTemplate: null })} className="rounded-sm text-sm text-muted hover:text-ink">
                  Volver a la plantilla generada
                </button>
              )}
            </div>
            {mode === "write" ? (
              <textarea
                aria-label="Plantilla de pull request en Markdown"
                value={template}
                onChange={(e) => patch({ prTemplate: e.target.value })}
                rows={16}
                spellCheck={false}
                className="w-full resize-y rounded-md border border-line-strong bg-surface px-3 py-2 font-mono text-[0.8125rem] leading-relaxed text-ink transition-colors duration-150 hover:border-muted"
              />
            ) : (
              <div className="min-h-40 rounded-md border border-line bg-surface p-4">
                <MarkdownPreview source={template} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default NewProjectGithubFiles;
