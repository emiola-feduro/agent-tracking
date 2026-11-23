import { z } from "zod";
import { ask, AssistantError, type AssistantConfig } from "./client";
import { projectBrief, type ProjectBrief } from "./prompt";

const MAX_CRITERIA = 8;

export type DodRequest = {
  project: ProjectBrief;
  requirement: { title: string; description?: string };
  /** Criteria the requirement already has; the answer must not repeat them. */
  existing?: string[];
};

const dodAnswerSchema = z.object({ criteria: z.array(z.string()) });

const SYSTEM = `You write the Definition of Done for one requirement of a software project tracked in Agent Tracking.
Each criterion must be verifiable: an observable behaviour, a measurable limit or an automated test that passes, so an agent or a reviewer can mark it done or failed without interpretation.
Cover the main flow, the relevant error cases and the business rules that apply to this requirement. Do not repeat the existing criteria or restate the requirement title.
Return between 3 and ${MAX_CRITERIA} criteria, in Spanish, each one short sentence without a trailing period, em dashes or bullet characters.`;

const key = (s: string) => s.toLowerCase().replace(/[.\s]+$/g, "").replace(/\s+/g, " ").trim();

/** Trims, drops empty and repeated criteria (also against the existing ones) and caps the list. */
export function normalizeCriteria(criteria: string[], existing: string[] = []): string[] {
  const seen = new Set(existing.map(key));
  const out: string[] = [];
  for (const raw of criteria) {
    const text = raw.trim().replace(/^[-*\d.)\s]+/, "").replace(/\.$/, "").trim();
    if (!text || seen.has(key(text))) continue;
    seen.add(key(text));
    out.push(text);
    if (out.length === MAX_CRITERIA) break;
  }
  return out;
}

/** Suggests criteria marked by the caller as origin "llm". Throws AssistantError when none are usable. */
export async function suggestDod(config: AssistantConfig, request: DodRequest): Promise<string[]> {
  const existing = (request.existing ?? []).filter((c) => c.trim());
  const { title, description } = request.requirement;
  const prompt = [
    projectBrief(request.project),
    `Requirement:\n<title>${title.trim()}</title>${description?.trim() ? `\n<description>${description.trim()}</description>` : ""}`,
    existing.length ? `Existing criteria:\n${existing.map((c) => `- ${c}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const answer = await ask(config, { model: config.models.default, effort: "medium", system: SYSTEM, prompt, schema: dodAnswerSchema });
  const criteria = normalizeCriteria(answer.criteria, existing);
  if (criteria.length === 0) throw new AssistantError("Sin criterios nuevos", "invalid");
  return criteria;
}
