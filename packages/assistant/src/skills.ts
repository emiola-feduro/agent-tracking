import { z } from "zod";
import { ask, AssistantError, modelFor, type AssistantConfig } from "./client";
import { projectBrief, type ProjectBrief } from "./prompt";

/** Larger catalogs are cut; the heuristic in the UI still covers the rest. */
export const MAX_SKILLS = 300;

export type SkillCandidate = { id: string; name: string; description: string };
export type SkillPick = { id: string; reason: string };

const SYSTEM = `You choose which of the installed Claude Code skills an agent should use while building this project.
Select a skill only when its description clearly applies to the project's platforms, stack, goal or rules. Generic skills that help on any project (testing discipline, code review) count only if they match the stack.
Answer with the ids of the selected skills. Each reason is one short sentence in Spanish saying what the skill brings to this project, without em dashes.
Selecting nothing is a valid answer.`;

/** Keeps known ids once, in the order given; drops empty reasons into a generic one. */
export function normalizeSkillPicks(picks: SkillPick[], candidates: SkillCandidate[]): SkillPick[] {
  const known = new Set(candidates.map((c) => c.id));
  const seen = new Set<string>();
  return picks.flatMap((p) => {
    if (!known.has(p.id) || seen.has(p.id)) return [];
    seen.add(p.id);
    return [{ id: p.id, reason: p.reason.trim() }];
  });
}

export async function suggestSkills(config: AssistantConfig, project: ProjectBrief, candidates: SkillCandidate[]): Promise<SkillPick[]> {
  const list = candidates.slice(0, MAX_SKILLS);
  if (list.length === 0) return [];
  const ids = list.map((c) => c.id) as [string, ...string[]];
  const schema = z.object({ skills: z.array(z.object({ id: z.enum(ids), reason: z.string() })) });
  const catalog = list.map((c) => `<skill id="${c.id}">\n${c.name}: ${c.description.trim() || "(sin descripción)"}\n</skill>`).join("\n");
  const answer = await ask(config, {
    model: modelFor(config, "skills"),
    effort: "low",
    system: SYSTEM,
    prompt: `${projectBrief(project)}\n\nInstalled skills:\n${catalog}`,
    schema,
  });
  if (!Array.isArray(answer.skills)) throw new AssistantError("Respuesta sin skills", "invalid");
  return normalizeSkillPicks(answer.skills, list);
}
