import {
  DATABASE_OPTIONS,
  DATABASE_SUGGESTIONS,
  recommendStack,
  STACK_OPTIONS,
  toggleStackOption,
  type Platform,
  type StackOption,
  type StackRecommendation,
} from "@agent-tracking/core";
import { z } from "zod";
import { ask, AssistantError, type AssistantConfig } from "./client";
import { projectBrief, type ProjectBrief } from "./prompt";

const MAX_ALTERNATIVES = 3;

export type StackSuggestion = {
  /** "assistant" when Claude's answer was valid; "default" when it fell back to recommendStack. */
  source: "assistant" | "default";
  recommendation: StackRecommendation;
};

const forPlatforms = <T extends { platforms: Platform[] }>(list: T[], platforms: Platform[]) =>
  list.filter((o) => o.platforms.some((p) => platforms.includes(p)));

export const stackOptionsFor = (platforms: Platform[]) => forPlatforms(STACK_OPTIONS, platforms);
export const databaseNamesFor = (platforms: Platform[]) => [
  ...new Set(forPlatforms([...DATABASE_OPTIONS, ...DATABASE_SUGGESTIONS], platforms).map((d) => d.name)),
];

/**
 * Applies the names through the same rules as the wizard: catalog options for these platforms only,
 * one per exclusive group (the last one wins), requirements added. Unknown names are dropped.
 */
export function consistentStack(names: string[], options: StackOption[]): string[] {
  const allowed = new Set(options.map((o) => o.name));
  let selected: string[] = [];
  for (const name of names) {
    if (allowed.has(name) && !selected.includes(name)) selected = toggleStackOption(selected, name, options);
  }
  return selected;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Turns the model's answer into a recommendation that the wizard can apply as is, or null when
 * nothing usable is left (then the caller falls back to recommendStack).
 */
export function normalizeStackAnswer(answer: StackAnswer, platforms: Platform[]): StackRecommendation | null {
  const options = stackOptionsFor(platforms);
  const databases = new Set(databaseNamesFor(platforms));
  const pick = (stack: string[], dbs: string[]) => ({
    stack: consistentStack(stack, options),
    databases: [...new Set(dbs.filter((d) => databases.has(d)))],
  });

  const main = pick(answer.stack, answer.databases);
  const rationale = answer.rationale.trim();
  if (main.stack.length === 0 || !rationale) return null;

  const alternatives: StackRecommendation["alternatives"] = [];
  for (const alt of answer.alternatives) {
    const option = pick(alt.stack, alt.databases);
    const when = alt.when.trim();
    if (option.stack.length === 0 || !when) continue;
    const duplicate = [main, ...alternatives].some((o) => sameSet(o.stack, option.stack) && sameSet(o.databases, option.databases));
    if (!duplicate) alternatives.push({ ...option, when });
    if (alternatives.length === MAX_ALTERNATIVES) break;
  }
  return { ...main, rationale, alternatives };
}

/** Built per request: the enums only admit the options of the chosen platforms. */
const stackAnswerSchema = (platforms: Platform[]) => {
  const stackNames = stackOptionsFor(platforms).map((o) => o.name) as [string, ...string[]];
  const dbNames = databaseNamesFor(platforms) as [string, ...string[]];
  const choice = { stack: z.array(z.enum(stackNames)), databases: z.array(z.enum(dbNames)) };
  return z.object({
    ...choice,
    rationale: z.string(),
    alternatives: z.array(z.object({ ...choice, when: z.string() })),
  });
};
export type StackAnswer = { stack: string[]; databases: string[]; rationale: string; alternatives: { stack: string[]; databases: string[]; when: string }[] };

const SYSTEM = `You recommend the technology stack for a software project tracked in Agent Tracking.
Pick only from the catalog you are given. Options in the same exclusive group cannot be combined, and an option listed with "requires" needs those options too.
Prefer a small, coherent stack: one UI framework per platform, one backend runtime and framework when a server is needed, one ORM, the main language, one unit test runner and one end to end runner per platform.
Recommend databases only when the project stores data, and explain the choice in terms of the project's goal and business rules.
Give up to ${MAX_ALTERNATIVES} alternatives that differ in a meaningful way, each with the situation where it is the better choice.
Write "rationale" and "when" in Spanish, one or two short sentences each, without em dashes or bullet characters.`;

function catalogText(platforms: Platform[]) {
  const lines = stackOptionsFor(platforms).map((o) => {
    const extra = [o.group && `group ${o.group}`, o.excludesGroups?.length && `excludes ${o.excludesGroups.join(", ")}`, o.requires?.length && `requires ${o.requires.join(", ")}`]
      .filter(Boolean)
      .join("; ");
    return `- ${o.name} (${o.category}${extra ? `; ${extra}` : ""})`;
  });
  return `Stack catalog:\n${lines.join("\n")}\n\nDatabases: ${databaseNamesFor(platforms).join(", ")}`;
}

/**
 * Asks Claude for a stack and databases. Any failure or unusable answer falls back to the
 * deterministic recommendation, so the wizard always gets something it can apply.
 */
export async function suggestStack(
  config: AssistantConfig,
  brief: ProjectBrief,
  onFallback: (error: unknown) => void = () => {},
): Promise<StackSuggestion> {
  const { platforms } = brief;
  const fallback = (): StackSuggestion => ({ source: "default", recommendation: recommendStack(platforms) });
  if (platforms.length === 0) return fallback();
  try {
    const answer = await ask(config, {
      model: config.models.heavy,
      effort: "medium",
      system: SYSTEM,
      prompt: `${projectBrief(brief)}\n\n${catalogText(platforms)}`,
      schema: stackAnswerSchema(platforms),
    });
    const recommendation = normalizeStackAnswer(answer, platforms);
    if (!recommendation) throw new AssistantError("Stack vacío tras aplicar las reglas", "invalid");
    return { source: "assistant", recommendation };
  } catch (error) {
    onFallback(error);
    return fallback();
  }
}
