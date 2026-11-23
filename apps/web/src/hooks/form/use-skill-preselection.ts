import { useEffect, useMemo } from "react";
import useInstalledSkills from "@/hooks/data/use-installed-skills";
import type { DiscoveredSkill } from "@/lib/api";
import useWizardStore, { type SelectedSkill } from "@/stores/use-wizard-store";

export const skillKey = (s: DiscoveredSkill) => `${s.source}:${s.plugin ?? ""}:${s.name}`;
export const withKey = (s: DiscoveredSkill): SelectedSkill => ({ ...s, key: skillKey(s) });

/**
 * Lists installed skills and, the first time, preselects repo skills and those whose text mentions
 * the chosen stack. The LLM assistant phase replaces this heuristic.
 */
const useSkillPreselection = () => {
  const repoPath = useWizardStore((s) => s.repo?.repo.root ?? null);
  const stack = useWizardStore((s) => s.stack);
  const preselected = useWizardStore((s) => s.skillsPreselected);
  const patch = useWizardStore((s) => s.patch);
  const query = useInstalledSkills(repoPath);
  const skills = useMemo(() => (query.data ?? []).map(withKey), [query.data]);

  useEffect(() => {
    if (!query.data || preselected) return;
    // Whole-word match on the stack names ("orm" must not match "information").
    const words = stack.map((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).filter((w) => w.length > 2);
    const patterns = words.map((w) => new RegExp(`\\b${w.replace(/ /g, "[^a-z0-9]+")}\\b`));
    const picked: Record<string, SelectedSkill> = {};
    for (const skill of skills) {
      const text = `${skill.name} ${skill.description}`.toLowerCase();
      if (skill.source === "repo" || patterns.some((p) => p.test(text))) picked[skill.key] = skill;
    }
    patch({ skills: picked, skillsPreselected: true });
  }, [query.data, skills, stack, preselected, patch]);

  return { ...query, skills };
};

export default useSkillPreselection;
