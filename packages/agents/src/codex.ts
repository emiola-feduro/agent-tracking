import { blockStop, commandText, denyPreToolUse, describeMcp, patchFiles, str, step } from "./describe";
import type { AgentAdapter, AgentEvent } from "./types";

/**
 * Codex CLI. Its hooks follow Claude Code's protocol (event names, fields, PreToolUse denial, Stop
 * `decision: block`), configured in $CODEX_HOME/hooks.json; Codex runs them only after the person
 * trusts them with /hooks. Shell commands arrive as `Bash` (also unified exec) with
 * `tool_input.command`; file edits as `apply_patch` with the patch in `tool_input.command`.
 */
export const codex: AgentAdapter = {
  kind: "codex",
  label: "Codex CLI",
  contextFile: "AGENTS.md",
  clientNames: ["codex", "codex-mcp-client", "codex-cli"],
  denyTool: denyPreToolUse,
  continueWith: blockStop,
  normalize(payload) {
    const p = (payload ?? {}) as Record<string, unknown>;
    if (typeof p.cwd !== "string") return null;
    const event = p.hook_event_name;
    if (event !== "UserPromptSubmit" && event !== "PreToolUse" && event !== "Stop" && event !== "SessionEnd") return null;
    return {
      agent: "codex",
      hook_event_name: event,
      session_id: str(p.session_id),
      cwd: p.cwd,
      prompt: str(p.prompt),
      tool_name: str(p.tool_name),
      tool_input: (p.tool_input && typeof p.tool_input === "object" ? p.tool_input : undefined) as AgentEvent["tool_input"],
      last_assistant_message: str(p.last_assistant_message),
      transcript_path: str(p.transcript_path),
      stop_hook_active: p.stop_hook_active === true,
    };
  },
  describeTool(tool, input) {
    const mcp = describeMcp(tool, "__");
    if (mcp) return mcp;
    const name = tool.toLowerCase();
    const patch = patchFiles(input.patch ?? input.input ?? input.content ?? (name === "apply_patch" ? input.command : undefined));
    if (name.includes("patch") || patch.length) return step(patch.length ? "Edita" : "Aplica un parche", patch.join(", "));
    const command = commandText(input.command ?? input.cmd ?? input.argv);
    if (command || /shell|exec|command|bash/.test(name)) return step("Ejecuta", command);
    const path = str(input.file_path) ?? str(input.path);
    if (/read|view|cat/.test(name)) return step("Lee", path);
    if (/write|create/.test(name)) return step("Escribe", path);
    if (/search|grep|find|glob/.test(name)) return step("Busca", str(input.pattern) ?? str(input.query) ?? path);
    if (/web/.test(name)) return step("Busca en la web", str(input.query) ?? str(input.url));
    if (/plan|todo/.test(name)) return step("Actualiza su plan");
    return step(tool, path);
  },
};
