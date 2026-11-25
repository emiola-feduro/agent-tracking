import GithubPublishFields from "@/components/dynamic/github-publish/github-publish-fields";
import CheckOption from "@/components/ui/check-option/check-option";
import useWizardStore from "@/stores/use-wizard-store";

/** Offer to create the repository on GitHub when the local repo has no remote yet. */
const NewProjectGithubPublish = () => {
  const repo = useWizardStore((s) => s.repo);
  const publish = useWizardStore((s) => s.publish);
  const patch = useWizardStore((s) => s.patch);
  if (!repo || repo.repo.remoteUrl) return null;
  const enabled = !!publish?.enabled;

  return (
    <section aria-labelledby="publish-title" className="flex flex-col gap-3 border-t border-line pt-6">
      <div>
        <h3 id="publish-title" className="font-semibold text-ink">
          GitHub
        </h3>
        <p className="text-sm text-ink-soft">Este repositorio todavía no está en GitHub.</p>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-line p-1">
        <CheckOption
          checked={enabled}
          onChange={() =>
            patch({ publish: enabled ? { ...publish!, enabled: false } : { owner: "", name: repo.repo.name, visibility: "private", ...publish, enabled: true } })
          }
          label="Crear también el repositorio en GitHub"
          description="Al crear el proyecto. Usa tu sesión de GitHub CLI en este equipo."
        />
        {enabled && publish && (
          <div className="px-3 pb-3">
            <GithubPublishFields value={publish} onChange={(v) => patch({ publish: { ...v, enabled: true } })} />
          </div>
        )}
      </div>
    </section>
  );
};

export default NewProjectGithubPublish;
