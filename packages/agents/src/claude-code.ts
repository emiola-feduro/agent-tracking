import { open } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { denyPreToolUse, describeMcp, str, step } from "./describe";
import type { AgentAdapter, AgentEvent } from "./types";

const LABELS: Record<string, string> = {
  Read: "Lee",
  Write: "Escribe",
  Edit: "Edita",
  MultiEdit: "Edita",
  NotebookEdit: "Edita",
  Bash: "Ejecuta",
  Grep: "Busca",
  Glob: "Busca archivos",
  WebFetch: "Consulta",
  WebSearch: "Busca en la web",
  Task: "Delega",
  Agent: "Delega",
  TodoWrite: "Actualiza su lista de tareas",
};

type ClaudeHook = AgentEvent & { hook_event_name: string };

/** Claude Code hooks: UserPromptSubmit, PreToolUse, Stop and SessionEnd, already in our vocabulary. */
export const claudeCode: AgentAdapter = {
  kind: "claude-code",
  label: "Claude Code",
  contextFile: "CLAUDE.md",
  clientNames: ["claude-code", "claude"],
  denyTool: denyPreToolUse,
  normalize(payload) {
    const p = (payload ?? {}) as Partial<ClaudeHook>;
    if (typeof p.cwd !== "string") return null;
    if (!["UserPromptSubmit", "PreToolUse", "Stop", "SessionEnd"].includes(p.hook_event_name ?? "")) return null;
    return {
      agent: "claude-code",
      hook_event_name: p.hook_event_name as AgentEvent["hook_event_name"],
      session_id: p.session_id,
      cwd: p.cwd,
      prompt: p.prompt,
      tool_name: p.tool_name,
      tool_input: p.tool_input,
      last_assistant_message: p.last_assistant_message,
      transcript_path: p.transcript_path,
    };
  },
  describeTool(tool, input) {
    const mcp = describeMcp(tool, "__");
    if (mcp) return mcp;
    const path = str(input.file_path) ?? str(input.notebook_path) ?? str(input.path);
    const target =
      tool === "Bash"
        ? (str(input.description) ?? str(input.command))
        : tool === "Grep" || tool === "Glob"
          ? str(input.pattern)
          : tool === "WebFetch"
            ? str(input.url)
            : tool === "WebSearch"
              ? str(input.query)
              : tool === "Task" || tool === "Agent"
                ? str(input.description)
                : path;
    return step(LABELS[tool] ?? tool, target);
  },
};

/** Only the end of a transcript is read: the last answer is there. */
const TRANSCRIPT_TAIL = 512 * 1024;

/**
 * Claude Code's final answer for the turn, read from the end of its transcript (JSONL under
 * ~/.claude/projects). Paths outside `claudeHome` are never read.
 */
export async function claudeLastMessage(transcriptPath: string | undefined, claudeHome: string): Promise<string> {
  if (!transcriptPath || !isAbsolute(transcriptPath) || !transcriptPath.endsWith(".jsonl")) return "";
  const rel = relative(resolve(claudeHome), resolve(transcriptPath));
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return "";
  const file = await open(transcriptPath, "r").catch(() => null);
  if (!file) return "";
  try {
    const { size } = await file.stat();
    const start = Math.max(0, size - TRANSCRIPT_TAIL);
    const buffer = Buffer.alloc(size - start);
    await file.read(buffer, 0, buffer.length, start);
    for (const line of buffer.toString("utf8").split("\n").reverse()) {
      if (!line.includes('"assistant"')) continue;
      try {
        const entry = JSON.parse(line) as { type?: string; message?: { content?: unknown } };
        if (entry.type !== "assistant" || !Array.isArray(entry.message?.content)) continue;
        const text = (entry.message.content as { type?: string; text?: string }[])
          .filter((b) => b.type === "text" && b.text?.trim())
          .map((b) => b.text!.trim())
          .join("\n\n");
        if (text) return text;
      } catch {
        /* a line cut by the tail window */
      }
    }
    return "";
  } finally {
    await file.close();
  }
}
