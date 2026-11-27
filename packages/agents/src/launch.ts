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

/** One thing to implement: a whole requirement, or only some of its Definition of Done criteria. */
export type LaunchItem = {
  requirement: { code?: string | null; title: string; description?: string };
  /** The requirement's criteria still pending (all of them for a whole requirement). */
  criteria: { id: string; criterion: string }[];
  /** True when only these criteria were chosen, not the whole requirement. */
  onlyCriteria: boolean;
};

/** Where the agent commits: a branch it names itself, one named by the person, or an existing one. */
export type LaunchBranch = { mode: "new" } | { mode: "named"; name: string } | { mode: "existing"; name: string };

export type LaunchTask = {
  project: string;
  items: LaunchItem[];
  branch?: LaunchBranch;
  /** Extra instructions the person wrote for this run. */
  instructions?: string;
};

function branchRule(branch: LaunchBranch | undefined): string {
  if (branch?.mode === "named") return `Antes de cambiar código, crea la rama ${branch.name} desde la actual (git switch -c ${branch.name}) y trabaja en ella.`;
  if (branch?.mode === "existing") {
    return `Trabaja en la rama existente ${branch.name}: si no estás en ella, cámbiate con git switch ${branch.name}. Si hay cambios sin commit que no son tuyos, no los descartes: detente y avísalo.`;
  }
  return "Antes de cambiar código, crea una rama feat/ o fix/ desde la actual (salvo que ya estés en una rama de trabajo).";
}

const nameOf = (r: LaunchItem["requirement"]) => (r.code ? `${r.code} «${r.title}»` : `«${r.title}»`);

/** Short label of what a run works on: "RF3", "RF3 y RF5", "2 criterios de RF7". */
export function launchLabel(items: LaunchItem[]): string {
  const parts = items.map((i) => {
    const ref = i.requirement.code ?? i.requirement.title;
    return i.onlyCriteria ? `${i.criteria.length === 1 ? "1 criterio" : `${i.criteria.length} criterios`} de ${ref}` : ref;
  });
  return parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`;
}

/**
 * What the agent is asked to do: the tasks in order, each requirement by its code (the MCP tools
 * take it) with the criteria to meet and their ids (for submit_report), then the usual rules.
 */
export function launchPrompt(task: LaunchTask): string {
  const many = task.items.length > 1;
  const blocks = task.items.map((item, i) => {
    const head = item.onlyCriteria
      ? `Del requerimiento ${nameOf(item.requirement)}, solo estos criterios del Definition of Done:`
      : `El requerimiento ${nameOf(item.requirement)} completo.${item.criteria.length ? " Sus criterios del Definition of Done:" : ""}`;
    const description = !item.onlyCriteria && item.requirement.description?.trim() ? `\n   Descripción: ${item.requirement.description.trim()}` : "";
    const criteria = item.criteria.map((c) => `\n   - ${c.criterion} (id ${c.id})`).join("");
    return `${many ? `${i + 1}. ` : ""}${head}${description}${criteria}`;
  });
  const refs = task.items.map((i) => `"${i.requirement.code ?? i.requirement.title}"`).join(", ");
  return [
    many
      ? `En el proyecto ${task.project}, que se sigue con Agent Tracking, implementa estas tareas en orden, una por una:`
      : `En el proyecto ${task.project}, que se sigue con Agent Tracking, implementa:`,
    "",
    ...blocks,
    "",
    "Cómo trabajar:",
    `1. Lee el contexto: llama a get_project_context y a get_requirement con ${refs} (servidor MCP agent-tracking); si no tienes ese MCP, lee .agent-tracking/CONTEXT.md.`,
    `2. ${branchRule(task.branch)} Haz al menos un commit por tarea. No hagas push ni fusiones a main.`,
    "3. Cumple los criterios indicados y escribe los tests que pide el proyecto; córrelos. No implementes criterios que no estén en la lista.",
    "4. Al terminar todo, llama una vez a submit_report con lo que hiciste, por requerimiento y feature, con archivos, tests y los ids de los criterios cumplidos.",
    task.instructions?.trim() ? `\nIndicaciones adicionales:\n${task.instructions.trim()}` : "",
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n")
    .trim();
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
