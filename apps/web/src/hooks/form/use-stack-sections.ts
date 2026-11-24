import { STACK_CATEGORY_LABEL, STACK_OPTIONS, stackOptionsFor, type StackCategory, type StackGroup, type StackOption } from "@agent-tracking/core";
import { useMemo } from "react";
import useWizardStore from "@/stores/use-wizard-store";

export type StackSection = {
  category: StackCategory;
  groups: { group: StackGroup; options: StackOption[] }[];
  loose: StackOption[];
};

/** Language and runtime first: most other choices depend on them. */
const ORDER: StackCategory[] = ["language", "frontend", "desktop", "mobile", "backend", "orm", "testing"];

/**
 * Categories and options that apply to the kind of project and its platforms. Anything already
 * selected stays visible so it can be removed after changing the kind or the platforms.
 */
const useStackSections = (): StackSection[] => {
  const kind = useWizardStore((s) => s.kind);
  const platforms = useWizardStore((s) => s.platforms);
  const stack = useWizardStore((s) => s.stack);

  return useMemo(() => {
    const applies = new Set(stackOptionsFor(kind, platforms).map((o) => o.name));
    const visible = STACK_OPTIONS.filter((o) => applies.has(o.name) || stack.includes(o.name));
    return ORDER.filter((c) => c in STACK_CATEGORY_LABEL)
      .map((category) => {
        const options = visible.filter((o) => o.category === category);
        const groups: StackSection["groups"] = [];
        for (const option of options) {
          if (!option.group) continue;
          const existing = groups.find((g) => g.group === option.group);
          if (existing) existing.options.push(option);
          else groups.push({ group: option.group, options: [option] });
        }
        return { category, groups, loose: options.filter((o) => !o.group) };
      })
      .filter((s) => s.groups.length > 0 || s.loose.length > 0);
  }, [kind, platforms, stack]);
};

export default useStackSections;
