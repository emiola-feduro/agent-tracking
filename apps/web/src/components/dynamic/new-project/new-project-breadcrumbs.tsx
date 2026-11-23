import useWizardStore, { canOpenStep, WIZARD_STEPS } from "@/stores/use-wizard-store";

const NewProjectBreadcrumbs = () => {
  const state = useWizardStore();
  const { step, reached, goTo } = state;

  return (
    <nav aria-label="Pasos del asistente" className="-mx-1 overflow-x-auto px-1">
      <ol className="flex min-w-max items-center gap-1">
        {WIZARD_STEPS.map(({ id, label }, index) => {
          const current = index === step;
          const done = index < reached || (index < step);
          const enabled = !current && canOpenStep(state, index) && index <= Math.max(reached, step + 1);
          return (
            <li key={id} className="flex items-center gap-1">
              {index > 0 && <span aria-hidden className="h-px w-4 bg-line-strong" />}
              <button
                type="button"
                onClick={() => goTo(index)}
                disabled={!enabled}
                aria-current={current ? "step" : undefined}
                className={`flex min-h-9 items-center gap-2 rounded-md px-2.5 text-sm transition-colors duration-150 ${current ? "bg-surface font-semibold text-ink shadow-[0_0_0_1px_var(--color-line)]" : enabled ? "text-ink-soft hover:bg-subtle hover:text-ink" : "cursor-default text-muted"}`}
              >
                <span
                  className={`grid size-5 place-items-center rounded-full text-xs font-semibold tabular-nums transition-colors duration-200 ${current || done ? "bg-brand text-on-brand" : "bg-subtle text-muted"}`}
                >
                  {index + 1}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default NewProjectBreadcrumbs;
