import { monorepoToolLabel, PROJECT_KIND_INFO, REPLY_LANGUAGE_INFO, recommendMonorepoTool, testTypeLabel } from "@agent-tracking/core";
import type { ReactNode } from "react";
import { platformList } from "@/lib/labels";
import useWizardStore, { effectiveTestTypes, projectShape, WIZARD_STEPS, type StepId } from "@/stores/use-wizard-store";
import NewProjectScaffold from "./new-project-scaffold";
import NewProjectGithubFiles from "./new-project-github-files";
import NewProjectGithubPublish from "./new-project-github-publish";

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
  const { name, databases, repo, repoUrl, skills, goal, rules, requirements } = s;
  const { kind, platforms, stack } = projectShape(s);
  const monorepo = s.structure === "monorepo";
  const filledRequirements = requirements.filter((r) => r.title.trim());
  const criteria = filledRequirements.reduce((n, r) => n + r.dod.filter((d) => d.trim()).length + r.llmDod.length, 0);
  const skillNames = Object.values(skills).map((k) => k.name);

  return (
    <div className="flex flex-col gap-6">
      <dl className="flex flex-col divide-y divide-line">
        <Row label="Nombre" step="basics">
          {name}
        </Row>
        <Row label="Tipo de proyecto" step="basics">
          {PROJECT_KIND_INFO[kind].label}
        </Row>
        {monorepo && (
          <Row label="Monorepo" step="stack">
            {s.parts.length} piezas con {monorepoToolLabel(s.monorepoTool ?? recommendMonorepoTool(s.parts))}
          </Row>
        )}
        {monorepo &&
          s.parts.map((p) => (
            <Row key={p.id} label={p.name} step="basics">
              <span className="text-ink-soft">{PROJECT_KIND_INFO[p.kind].label}</span> en <code className="font-mono text-[0.8125rem]">{p.path}</code>
              {p.stack.length > 0 && <span className="text-ink-soft">: {p.stack.join(", ")}</span>}
            </Row>
          ))}
        {PROJECT_KIND_INFO[kind].platforms === null && (
          <Row label="Plataformas" step="basics">
            {platformList(platforms)}
          </Row>
        )}
        <Row label="Repositorio" step={repo ? "source" : "basics"}>
          {repo ? <code className="font-mono text-[0.8125rem]">{repo.repo.root}</code> : repoUrl || "Sin repositorio"}
        </Row>
        <Row label="Stack" step="stack">
          {stack.join(", ")}
        </Row>
        <Row label="Bases de datos" step="stack">
          {databases.join(", ") || "Sin definir"}
        </Row>
        <Row label="Tests" step="stack">
          {effectiveTestTypes(s).map(testTypeLabel).join(", ") || "Ninguno"}
        </Row>
        <Row label="Idioma de los agentes" step="basics">
          {s.replyLanguage ? REPLY_LANGUAGE_INFO[s.replyLanguage].label : "Sin indicar"}
        </Row>
        <Row label="Skills" step="skills">
          {skillNames.length ? skillNames.join(", ") : "Ninguna"}
        </Row>
        <Row label="Objetivo" step="goal">
          {goal}
        </Row>
        <Row label="Convenciones" step="goal">
          {s.commitConventions
            ? `Propias: ${s.commitConventions.types.join(", ")}${s.commitConventions.custom.trim() ? ", con reglas del equipo" : ""}`
            : "Por defecto (Conventional Commits)"}
        </Row>
        <Row label="Reglas" step="goal">
          {rules.filter((r) => r.trim()).length}
        </Row>
        <Row label="Requerimientos" step="requirements">
          {filledRequirements.length} con {criteria} criterios de Definition of Done
        </Row>
      </dl>
      <NewProjectScaffold />
      {repo && !repo.existingProjectId && !repo.projectFile && <NewProjectGithubFiles />}
      {repo && !repo.existingProjectId && !repo.projectFile && <NewProjectGithubPublish />}
    </div>
  );
};

export default NewProjectSummary;
