import useWizardStore, { WIZARD_STEPS } from "@/stores/use-wizard-store";
import NewProjectBasics from "./new-project-basics";
import NewProjectBreadcrumbs from "./new-project-breadcrumbs";
import NewProjectGoal from "./new-project-goal";
import NewProjectNav from "./new-project-nav";
import NewProjectRequirements from "./new-project-requirements";
import NewProjectSkills from "./new-project-skills";
import NewProjectSource from "./new-project-source";
import NewProjectStack from "./new-project-stack";
import NewProjectSummary from "./new-project-summary";

const STEP_COMPONENTS = {
  source: NewProjectSource,
  basics: NewProjectBasics,
  stack: NewProjectStack,
  skills: NewProjectSkills,
  goal: NewProjectGoal,
  requirements: NewProjectRequirements,
  summary: NewProjectSummary,
};

const NewProject = () => {
  const step = useWizardStore((s) => s.step);
  const { id, label } = WIZARD_STEPS[step]!;
  const Step = STEP_COMPONENTS[id];

  return (
    <div className="flex flex-col gap-6">
      <NewProjectBreadcrumbs />
      <section aria-labelledby="wizard-step-title" className="rounded-lg border border-line bg-surface">
        <div key={id} className="flex animate-enter flex-col gap-6 p-5 sm:p-6">
          <h2 id="wizard-step-title" className="text-xl font-semibold text-ink">
            {label}
          </h2>
          <Step />
        </div>
        <NewProjectNav />
      </section>
    </div>
  );
};

export default NewProject;
