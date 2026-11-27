import type { AgentKind } from "./types";

/**
 * Starting a coding agent without its interface, with one task: the command line for each agent's
 * non-interactive mode and the instruction it receives. Two permission levels:
 * - "safe": the agent edits files and runs what its own safety layer allows (Claude Code's auto mode,
 *   Codex's workspace sandbox, Gemini's automatic edits); anything else is refused, never asked.
 * - "full": no questions and no sandbox. Only for repositories the person trusts the agent with.
 */
export const LAUNCH_PERMISSIONS = ["safe", "full"] as const;
export type LaunchPermission = (typeof LAUNCH_PERMISSIONS)[number];

export const LAUNCH_BINARIES: Record<AgentKind, string> = { "claude-code": "claude", codex: "codex", "gemini-cli": "gemini" };

export type LaunchTask = {
  project: string;
  requirement: { code?: string | null; title: string; description?: string };
  /** Extra instructions the person wrote for this run. */
  instructions?: string;
};

/** What the agent is asked to do; the requirement goes by its code so the MCP tools can find it. */
export function launchPrompt(task: LaunchTask): string {
  const { code, title, description } = task.requirement;
  const name = code ? `${code} «${title}»` : `«${title}»`;
  const ref = code ?? title;
  return [
    `Implementa el requerimiento ${name} del proyecto ${task.project}, que se sigue con Agent Tracking.`,
    description?.trim() ? `\nDescripción del requerimiento:\n${description.trim()}\n` : "",
    "Pasos:",
    `1. Lee el contexto: llama a get_project_context y a get_requirement con "${ref}" (servidor MCP agent-tracking); si no tienes ese MCP, lee .agent-tracking/CONTEXT.md.`,
    "2. Antes de cambiar código, crea una rama feat/ o fix/ desde la actual (salvo que ya estés en una rama de trabajo) y haz commits pequeños mientras avanzas. No hagas push ni fusiones a main.",
    "3. Cumple los criterios del Definition of Done y escribe los tests que pide el proyecto; córrelos.",
    "4. Al terminar, llama una vez a submit_report con lo que hiciste, por feature, con archivos, tests y criterios del DoD cumplidos.",
    task.instructions?.trim() ? `\nIndicaciones adicionales:\n${task.instructions.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** argv to start `agent` on `prompt` in its non-interactive mode (run with the checkout as cwd). */
export function launchCommand(agent: AgentKind, prompt: string, permission: LaunchPermission, model?: string): string[] {
  const withModel = (flag: string) => (model?.trim() ? [flag, model.trim()] : []);
  switch (agent) {
    case "claude-code":
      return ["claude", "-p", "--permission-mode", permission === "full" ? "bypassPermissions" : "auto", ...withModel("--model"), prompt];
    case "codex":
      return ["codex", "exec", ...(permission === "full" ? ["--dangerously-bypass-approvals-and-sandbox"] : ["--full-auto"]), ...withModel("-m"), prompt];
    case "gemini-cli":
      return ["gemini", "--approval-mode", permission === "full" ? "yolo" : "auto_edit", ...withModel("-m"), "-p", prompt];
  }
}
