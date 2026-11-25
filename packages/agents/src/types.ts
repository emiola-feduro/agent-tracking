/**
 * What Agent Tracking knows about each coding agent: how its hooks speak, how its tools are named,
 * where its configuration lives. Everything agent-specific stays behind an AgentAdapter.
 */
export const AGENT_KINDS = ["claude-code", "codex", "gemini-cli"] as const;
export type AgentKind = (typeof AGENT_KINDS)[number];

/**
 * A hook event in Agent Tracking's own vocabulary. The event names follow Claude Code's, which Codex
 * shares; Gemini CLI's BeforeAgent/BeforeTool/AfterAgent are translated into them.
 */
export type AgentEvent = {
  agent: AgentKind;
  hook_event_name: "UserPromptSubmit" | "PreToolUse" | "Stop" | "SessionEnd";
  session_id?: string;
  cwd: string;
  prompt?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  /** The agent's final answer, when the hook carries it (Codex and Gemini do; Claude has a transcript). */
  last_assistant_message?: string;
  transcript_path?: string;
};

/** One line describing a tool call for the live view. */
export type ToolStep = { label: string; target?: string };

export interface AgentAdapter {
  kind: AgentKind;
  label: string;
  /** Turns a raw hook payload into an AgentEvent; null for events that say nothing worth tracking. */
  normalize(payload: unknown): AgentEvent | null;
  /** Spanish label and target for a tool call ("Edita src/app.ts"). */
  describeTool(tool: string, input: Record<string, unknown>): ToolStep;
  /** The instruction file the agent reads at the root of a repository. */
  contextFile: "CLAUDE.md" | "AGENTS.md" | "GEMINI.md";
  /** Names the agent reports as MCP client (clientInfo.name), lowercased, to recognize it in reports. */
  clientNames: string[];
}
