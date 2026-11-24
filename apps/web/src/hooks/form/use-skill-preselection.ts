import { useEffect, useMemo, useRef } from "react";
import useAssistantStatus from "@/hooks/data/use-assistant-status";
import useInstalledSkills from "@/hooks/data/use-installed-skills";
import { api, type DiscoveredSkill } from "@/lib/api";
import useWizardStore, { wizardBrief, type SelectedSkill } from "@/stores/use-wizard-store";

export const skillKey = (s: DiscoveredSkill) => `${s.source}:${s.plugin ?? ""}:${s.name}`;
export const withKey = (s: DiscoveredSkill): SelectedSkill => ({ ...s, key: skillKey(s) });

/** Repo skills plus those whose text mentions the chosen stack (whole words). Used without the assistant. */
const heuristicPicks = (skills: SelectedSkill[], stack: string[]) => {
  // "orm" must not match "information".
  const words = stack.map((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).filter((w) => w.length > 2);
  const patterns = words.map((w) => new RegExp(`\\b${w.replace(/ /g, "[^a-z0-9]+")}\\b`));
  return skills.filter((skill) => {
    const text = `${skill.name} ${skill.description}`.toLowerCase();
    return skill.source === "repo" || patterns.some((p) => p.test(text));
  });
};

const byKey = (list: SelectedSkill[]) => Object.fromEntries(list.map((s) => [s.key, s]));

/**
 * Lists installed skills and, the first time, preselects the relevant ones: with the assistant,
 * Claude picks them (repo skills always stay); without it, or if it fails, the word heuristic does.
 */
const useSkillPreselection = () => {
  const repoPath = useWizardStore((s) => s.repo?.repo.root ?? null);
  const preselected = useWizardStore((s) => s.skillsPreselected);
  const patch = useWizardStore((s) => s.patch);
  const assistant = useAssistantStatus();
  const query = useInstalledSkills(repoPath);
  const skills = useMemo(() => (query.data ?? []).map(withKey), [query.data]);
  const asking = useRef(false);

  useEffect(() => {
    if (!query.data || preselected || !assistant.settled || asking.current) return;
    const state = useWizardStore.getState();
    const fallback = () => patch({ skills: byKey(heuristicPicks(skills, state.stack)), skillReasons: {}, skillsPreselected: true });
    if (!assistant.configured || skills.length === 0) return fallback();

    asking.current = true;
    const candidates = skills.map((s) => ({ id: s.key, name: s.name, description: s.description }));
    api
      .suggestSkills(wizardBrief(state), candidates)
      .then(({ skills: picks }) => {
        const reasons = Object.fromEntries(picks.map((p) => [p.id, p.reason]));
        const picked = skills.filter((s) => s.source === "repo" || reasons[s.key] !== undefined);
        patch({ skills: byKey(picked), skillReasons: reasons, skillsPreselected: true });
      })
      .catch(fallback)
      .finally(() => {
        asking.current = false;
      });
  }, [query.data, skills, preselected, assistant.settled, assistant.configured, patch]);

  // Keep the skeleton until the first preselection is in place.
  const status = query.status === "success" && !preselected ? "pending" : query.status;
  return { ...query, status, skills };
};

export default useSkillPreselection;
