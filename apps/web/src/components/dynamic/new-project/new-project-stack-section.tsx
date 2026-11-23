import { STACK_CATEGORY_LABEL, STACK_GROUP_LABEL } from "@agent-tracking/core";
import CheckOption from "@/components/ui/check-option/check-option";
import type { StackSection } from "@/hooks/form/use-stack-sections";
import useWizardStore from "@/stores/use-wizard-store";

const NewProjectStackSection = ({ section }: { section: StackSection }) => {
  const { category, groups, loose } = section;
  const stack = useWizardStore((s) => s.stack);
  const toggleIn = useWizardStore((s) => s.toggleIn);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 px-3 font-semibold text-ink">{STACK_CATEGORY_LABEL[category]}</legend>
      {groups.map(({ group, options }) => {
        const chosen = options.find((o) => stack.includes(o.name));
        return (
          <div key={group} role="radiogroup" aria-label={`${STACK_GROUP_LABEL[group]}, solo uno`} className="flex flex-col">
            <div className="flex min-h-7 items-center justify-between gap-2 px-3">
              <span className="text-sm text-ink-soft">{STACK_GROUP_LABEL[group]} (solo uno)</span>
              {chosen && (
                <button
                  type="button"
                  onClick={() => toggleIn("stack", chosen.name)}
                  className="rounded-sm text-sm text-muted transition-colors hover:text-ink"
                >
                  Quitar
                </button>
              )}
            </div>
            {options.map(({ name }) => (
              <CheckOption
                key={name}
                type="radio"
                name={`stack-${group}`}
                checked={stack.includes(name)}
                onChange={() => toggleIn("stack", name)}
                label={name}
              />
            ))}
          </div>
        );
      })}
      {loose.length > 0 && (
        <div className="flex flex-col">
          {groups.length > 0 && <span className="min-h-7 px-3 text-sm leading-7 text-ink-soft">Complementos</span>}
          {loose.map(({ name, requires }) => (
            <CheckOption
              key={name}
              checked={stack.includes(name)}
              onChange={() => toggleIn("stack", name)}
              label={name}
              meta={requires?.length ? <span className="text-sm font-normal text-muted">con {requires.join(" y ")}</span> : undefined}
            />
          ))}
        </div>
      )}
    </fieldset>
  );
};

export default NewProjectStackSection;
