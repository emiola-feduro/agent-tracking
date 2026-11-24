import type { Platform } from "@agent-tracking/core";

/** What the assistant knows about the project. Wizard drafts send partial data. */
export type ProjectBrief = {
  name?: string;
  goal?: string;
  platforms: Platform[];
  stack?: string[];
  databases?: string[];
  rules?: string[];
  requirements?: { title: string; description?: string }[];
};

const PLATFORM_LABEL: Record<Platform, string> = { web: "web", desktop: "desktop", mobile: "mobile (iOS and Android)" };

const clean = (list: string[] | undefined) => (list ?? []).map((s) => s.trim()).filter(Boolean);

/** Project description as plain text, leaving out what is empty. User text goes inside tags. */
export function projectBrief(brief: ProjectBrief): string {
  const parts = [`<platforms>${brief.platforms.map((p) => PLATFORM_LABEL[p]).join(", ")}</platforms>`];
  if (brief.name?.trim()) parts.push(`<project_name>${brief.name.trim()}</project_name>`);
  if (brief.goal?.trim()) parts.push(`<goal>${brief.goal.trim()}</goal>`);
  const stack = clean(brief.stack);
  if (stack.length) parts.push(`<stack>${stack.join(", ")}</stack>`);
  const databases = clean(brief.databases);
  if (databases.length) parts.push(`<databases>${databases.join(", ")}</databases>`);
  const rules = clean(brief.rules);
  if (rules.length) parts.push(`<business_rules>\n${rules.map((r) => `- ${r}`).join("\n")}\n</business_rules>`);
  const requirements = (brief.requirements ?? []).filter((r) => r.title.trim());
  if (requirements.length) {
    const lines = requirements.map((r) => `- ${r.title.trim()}${r.description?.trim() ? `: ${r.description.trim()}` : ""}`);
    parts.push(`<requirements>\n${lines.join("\n")}\n</requirements>`);
  }
  return `Project:\n${parts.join("\n")}`;
}
