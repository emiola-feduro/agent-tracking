import { describeMcp, str, step } from "./describe";
import type { AgentAdapter, AgentEvent } from "./types";

const EVENTS: Record<string, AgentEvent["hook_event_name"]> = {
  BeforeAgent: "UserPromptSubmit",
  BeforeTool: "PreToolUse",
  AfterAgent: "Stop",
  SessionEnd: "SessionEnd",
};

const LABELS: Record<string, string> = {
  read_file: "Lee",
  read_many_files: "Lee",
  write_file: "Escribe",
  replace: "Edita",
  run_shell_command: "Ejecuta",
  glob: "Busca archivos",
  grep_search: "Busca",
  search_file_content: "Busca",
  list_directory: "Lista",
  web_fetch: "Consulta",
  google_web_search: "Busca en la web",
  write_todos: "Actualiza su lista de tareas",
  activate_skill: "Usa la skill",
  ask_user: "Te pregunta",
};

/**
 * Gemini CLI hooks (settings.json): BeforeAgent carries the prompt, BeforeTool the tool call and
 * AfterAgent the final answer (prompt_response). MCP tools are named mcp_<server>_<tool>.
 */
export const geminiCli: AgentAdapter = {
  kind: "gemini-cli",
  label: "Gemini CLI",
  contextFile: "GEMINI.md",
  clientNames: ["gemini-cli", "gemini-cli-mcp-client", "gemini"],
  normalize(payload) {
    const p = (payload ?? {}) as Record<string, unknown>;
    const event = EVENTS[String(p.hook_event_name)];
    if (!event || typeof p.cwd !== "string") return null;
    return {
      agent: "gemini-cli",
      hook_event_name: event,
      session_id: str(p.session_id),
      cwd: p.cwd,
      prompt: str(p.prompt),
      tool_name: str(p.tool_name),
      tool_input: (p.tool_input && typeof p.tool_input === "object" ? p.tool_input : undefined) as AgentEvent["tool_input"],
      last_assistant_message: str(p.prompt_response),
      transcript_path: str(p.transcript_path),
    };
  },
  describeTool(tool, input) {
    const mcp = describeMcp(tool, "_");
    if (mcp && !LABELS[tool]) return mcp;
    const target =
      tool === "run_shell_command"
        ? (str(input.description) ?? str(input.command))
        : tool === "glob" || tool === "grep_search" || tool === "search_file_content"
          ? str(input.pattern)
          : tool === "google_web_search"
            ? str(input.query)
            : tool === "web_fetch"
              ? str(input.prompt)
              : tool === "activate_skill"
                ? str(input.name)
                : (str(input.file_path) ?? str(input.dir_path));
    return step(LABELS[tool] ?? tool, target);
  },
};
