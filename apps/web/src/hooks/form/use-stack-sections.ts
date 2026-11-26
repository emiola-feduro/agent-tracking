import {
  STACK_CATEGORY_LABEL,
  STACK_LANGUAGES,
  STACK_OPTIONS,
  stackLanguages,
  stackOptionsFor,
  unlockedByLanguage,
  type StackCategory,
  type StackGroup,
  type StackOption,
} from "@agent-tracking/core";
import { useMemo } from "react";
import useWizardStore, { selectKind, selectPlatforms, selectStack } from "@/stores/use-wizard-store";

export type StackSection = {
  category: StackCategory;
  groups: { group: StackGroup; options: StackOption[] }[];
  loose: StackOption[];
  /** Languages that would show more options in this section, most useful first. */
  moreWith: string[];
};

const ORDER: StackCategory[] = ["frontend", "crossplatform", "desktop", "mobile", "backend", "orm", "testing"];

const toSection = (category: StackCategory, options: StackOption[], moreWith: string[]): StackSection => {
  const groups: StackSection["groups"] = [];
  for (const option of options) {
    if (!option.group) continue;
    const existing = groups.find((g) => g.group === option.group);
    if (existing) existing.options.push(option);
    else groups.push({ group: option.group, options: [option] });
  }
  return { category, groups, loose: options.filter((o) => !o.group), moreWith };
};

/**
 * The technologies step, guided by language: first the languages (and the JavaScript runtime once
 * TypeScript or JavaScript is chosen), then only the frameworks, ORMs and tests those languages use.
 * Everything else applies to the kind of project and its platforms. Anything already selected stays
 * visible so it can be removed after changing the kind, the platforms or the languages.
 */
const useStackSections = (): {
  languages: StackSection;
  chosenLanguages: string[];
  sections: StackSection[];
} => {
  const kind = useWizardStore(selectKind);
  const platforms = useWizardStore(selectPlatforms);
  const stack = useWizardStore(selectStack);

  return useMemo(() => {
    const applies = new Set(stackOptionsFor(kind, platforms).map((o) => o.name));
    const fits = STACK_OPTIONS.filter((o) => applies.has(o.name) || stack.includes(o.name));
    const chosenLanguages = STACK_LANGUAGES.filter((l) => stack.includes(l));
    const open = (o: StackOption) => stack.includes(o.name) || unlockedByLanguage(o.name, chosenLanguages);

    const languageOptions = fits.filter((o) => o.category === "language" && (!o.group || open(o)));
    const sections = ORDER.filter((c) => c in STACK_CATEGORY_LABEL)
      .map((category) => {
        const all = fits.filter((o) => o.category === category);
        const shown = all.filter(open);
        // Which languages would show the hidden ones, the one that opens most first.
        const count = new Map<string, number>();
        for (const o of all) {
          if (open(o)) continue;
          for (const l of stackLanguages(o.name) ?? []) if (!chosenLanguages.includes(l)) count.set(l, (count.get(l) ?? 0) + 1);
        }
        const moreWith = [...count].sort((a, b) => b[1] - a[1]).map(([l]) => l);
        return toSection(category, shown, moreWith);
      })
      .filter((s) => s.groups.length > 0 || s.loose.length > 0 || s.moreWith.length > 0);
    return {
      languages: toSection("language", languageOptions, []),
      chosenLanguages,
      sections,
    };
  }, [kind, platforms, stack]);
};

export default useStackSections;
