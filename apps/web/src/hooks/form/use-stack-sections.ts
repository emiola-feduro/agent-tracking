import { CATEGORY_PLATFORM, STACK_CATEGORY_LABEL, STACK_OPTIONS, type StackCategory, type StackGroup, type StackOption } from "@agent-tracking/core";
import { useMemo } from "react";
import useWizardStore from "@/stores/use-wizard-store";

export type StackSection = {
  category: StackCategory;
  groups: { group: StackGroup; options: StackOption[] }[];
  loose: StackOption[];
};

/**
 * Categories and options that apply to the chosen platforms. Anything already selected stays
 * visible so it can be removed after changing platforms.
 */
const useStackSections = (): StackSection[] => {
  const platforms = useWizardStore((s) => s.platforms);
  const stack = useWizardStore((s) => s.stack);

  return useMemo(() => {
    const visible = STACK_OPTIONS.filter((o) => {
      if (stack.includes(o.name)) return true;
      const categoryPlatform = CATEGORY_PLATFORM[o.category];
      if (categoryPlatform && !platforms.includes(categoryPlatform)) return false;
      return o.platforms.some((p) => platforms.includes(p));
    });
    return (Object.keys(STACK_CATEGORY_LABEL) as StackCategory[])
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
  }, [platforms, stack]);
};

export default useStackSections;
