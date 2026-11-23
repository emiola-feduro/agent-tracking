import type { ReactNode } from "react";
import { platformList } from "@/lib/labels";
import useWizardStore, { WIZARD_STEPS, type StepId } from "@/stores/use-wizard-store";

const stepIndex = (id: StepId) => WIZARD_STEPS.findIndex((s) => s.id === id);

type RowProps = { label: string; step: StepId; children: ReactNode };

const Row = ({ label, step, children }: RowProps) => {
  const goTo = useWizardStore((s) => s.goTo);
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[160px_1fr_auto] sm:items-baseline sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
      <dd>
        <button type="button" onClick={() => goTo(stepIndex(step))} className="rounded-sm text-sm font-medium text-brand hover:underline">
          Editar <span className="sr-only">{label.toLowerCase()}</span>
        </button>
      </dd>
    </div>
  );
};

const NewProjectSummary = () => {
  const s = useWizardStore();
  const { name, platforms, stack, databases, repo, repoUrl, skills, goal, rules, requirements } = s;
  const filledRequirements = requirements.filter((r) => r.title.trim());
  const criteria = filledRequirements.reduce((n, r) => n + r.dod.filter((d) => d.trim()).length + r.llmDod.length, 0);
  const skillNames = Object.values(skills).map((k) => k.name);

  return (
    <dl className="flex flex-col divide-y divide-line">
      <Row label="Nombre" step="basics">{name}</Row>
      <Row label="Plataformas" step="basics">{platformList(platforms)}</Row>
      <Row label="Repositorio" step={repo ? "source" : "basics"}>
        {repo ? <code className="font-mono text-[13px]">{repo.repo.root}</code> : repoUrl || "Sin repositorio"}
      </Row>
      <Row label="Stack" step="stack">{stack.join(", ")}</Row>
      <Row label="Bases de datos" step="stack">{databases.join(", ") || "Sin definir"}</Row>
      <Row label="Skills" step="skills">{skillNames.length ? skillNames.join(", ") : "Ninguna"}</Row>
      <Row label="Objetivo" step="goal">{goal}</Row>
      <Row label="Reglas" step="goal">{rules.filter((r) => r.trim()).length}</Row>
      <Row label="Requerimientos" step="requirements">
        {filledRequirements.length} con {criteria} criterios de Definition of Done
      </Row>
    </dl>
  );
};

export default NewProjectSummary;
