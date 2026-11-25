import type { ToolStep } from "./types";

const MAX_TARGET = 100;

const clip = (text: string) => {
  const line = text.split("\n")[0]!.trim();
  return line.length > MAX_TARGET ? `${line.slice(0, MAX_TARGET - 1)}…` : line;
};

export const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);

/** A shell command given as a string or as argv (["bash", "-lc", "bun test"] keeps the script). */
export const commandText = (v: unknown): string | undefined => {
  if (typeof v === "string") return str(v);
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
    const parts = v as string[];
    const script = parts.findIndex((p) => p === "-c" || p === "-lc");
    return str(script >= 0 ? parts.slice(script + 1).join(" ") : parts.join(" "));
  }
  return undefined;
};

/** Files named in an apply_patch body ("*** Update File: src/a.ts"). */
export const patchFiles = (patch: unknown): string[] =>
  typeof patch === "string" ? [...patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)].map((m) => m[1]!.trim()) : [];

/** Builds the step; the target is clipped to one short line and never holds file contents. */
export const step = (label: string, target?: string): ToolStep => (target ? { label, target: clip(target) } : { label });

/** MCP tools as `mcp__server__tool` (Claude, Codex) or `mcp_server_tool` (Gemini). */
export function describeMcp(tool: string, separator: "__" | "_"): ToolStep | null {
  const re = separator === "__" ? /^mcp__(.+?)__(.+)$/ : /^mcp_(.+?)_(.+)$/;
  const m = re.exec(tool);
  if (!m) return null;
  const [, server, name] = m;
  return step(server === "agent-tracking" || server === "agent_tracking" ? "Agent Tracking" : `MCP ${server}`, name!.replaceAll("_", " "));
}
