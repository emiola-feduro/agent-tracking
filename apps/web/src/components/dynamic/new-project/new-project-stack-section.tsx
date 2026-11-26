import { canSelectStackOption, STACK_CATEGORY_LABEL, STACK_GROUP_LABEL, STACK_OPTIONS, type StackOption } from "@agent-tracking/core";
import CheckOption from "@/components/ui/check-option/check-option";
import type { StackSection } from "@/hooks/form/use-stack-sections";
import useWizardStore, { selectStack } from "@/stores/use-wizard-store";

/** "Necesita un framework web": why an option cannot be picked with the current selection. */
const NeedsHint = ({ option }: { option: StackOption }) => {
  // When the option itself has no condition, the wait comes from what it requires (Bun test needs Bun).
  const via = option.needsAny ? option : STACK_OPTIONS.find((o) => option.requires?.includes(o.name) && o.needsAny);
  return (
    <span className="text-sm font-normal text-muted">necesita {via?.needsLabel ?? via?.needsAny?.join(" o ") ?? option.requires?.join(" y ")}</span>
  );
};

type NewProjectStackSectionProps = {
  section: StackSection;
  /** The languages step: no title (the step has one) and the options in columns. */
  columns?: boolean;
};

const NewProjectStackSection = ({ section, columns = false }: NewProjectStackSectionProps) => {
  const { category, groups, loose, moreWith } = section;
  const stack = useWizardStore(selectStack);
  const toggleIn = useWizardStore((s) => s.toggleIn);
  const blocked = (o: StackOption) => !canSelectStackOption(o.name, stack);

  // Free options; in the languages step they come before the runtime.
  const looseList = loose.length > 0 && (
    <div className={columns ? "grid grid-cols-2 sm:grid-cols-3" : "flex flex-col"}>
      {groups.length > 0 && !columns && <span className="min-h-7 px-3 text-sm leading-7 text-ink-soft">Complementos</span>}
      {loose.map((option) => (
        <CheckOption
          key={option.name}
          checked={stack.includes(option.name)}
          disabled={blocked(option)}
          onChange={() => toggleIn("stack", option.name)}
          label={option.name}
          meta={
            blocked(option) ? (
              <NeedsHint option={option} />
            ) : option.requires?.length ? (
              <span className="text-sm font-normal text-muted">con {option.requires.join(" y ")}</span>
            ) : undefined
          }
        />
      ))}
    </div>
  );

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={columns ? "sr-only" : "mb-1 px-3 font-semibold text-ink"}>{STACK_CATEGORY_LABEL[category]}</legend>
      {columns && looseList}
      {groups.map(({ group, options }) => {
        const chosen = options.find((o) => stack.includes(o.name));
        // When every option waits on the same thing, say it once for the group.
        const groupBlocked = options.every(blocked) && !!options[0]!.needsLabel && options.every((o) => o.needsLabel === options[0]!.needsLabel);
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
            {groupBlocked && <p className="px-3 pb-1 text-sm text-muted">Necesita {options[0]!.needsLabel}.</p>}
            {options.map((option) => (
              <CheckOption
                key={option.name}
                type="radio"
                name={`stack-${group}`}
                checked={stack.includes(option.name)}
                disabled={blocked(option)}
                onChange={() => toggleIn("stack", option.name)}
                label={option.name}
                meta={blocked(option) && !groupBlocked ? <NeedsHint option={option} /> : undefined}
              />
            ))}
          </div>
        );
      })}
      {!columns && looseList}
      {groups.length === 0 && loose.length === 0 && <p className="px-3 text-sm text-muted">Nada compatible con los lenguajes elegidos.</p>}
      {moreWith.length > 0 && (
        <p className="flex flex-wrap items-center gap-1 px-3 text-sm text-muted">
          Más opciones con
          {moreWith.slice(0, 4).map((language) => (
            <button
              key={language}
              type="button"
              onClick={() => toggleIn("stack", language)}
              aria-label={`Agregar ${language} para ver más opciones de ${STACK_CATEGORY_LABEL[category]}`}
              className="rounded-sm border border-line px-1.5 py-0.5 text-xs text-ink-soft transition-colors hover:border-brand hover:text-ink"
            >
              + {language}
            </button>
          ))}
        </p>
      )}
    </fieldset>
  );
};

export default NewProjectStackSection;
