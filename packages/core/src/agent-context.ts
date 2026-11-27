import { GIT_WORK_RULES } from "./conventions";
import { replyLanguageRule } from "./reply-language";
import { testTypeLabel } from "./test-policy";
import { CONTEXT_FILE_PATH } from "./project-file";
import { sharedSkillPath } from "./requirements";
import type { ProjectSnapshot } from "./types";

/**
 * The short block Agent Tracking keeps in each agent's own instruction file (CLAUDE.md, AGENTS.md,
 * GEMINI.md) so any agent, with or without hooks, finds the project context and how to report.
 * Only the text between the markers is ever touched.
 */
export const BLOCK_START = "<!-- agent-tracking:start (Agent Tracking mantiene este bloque; no lo edites a mano) -->";
export const BLOCK_END = "<!-- agent-tracking:end -->";

export function agentContextBlock(s: ProjectSnapshot): string {
  const skills = s.skills.filter((k) => k.enabled && k.shared);
  return [
    BLOCK_START,
    "## Agent Tracking",
    "",
    `Este proyecto se sigue con Agent Tracking. Antes de trabajar, lee \`${CONTEXT_FILE_PATH}\`: objetivo, reglas de negocio, requerimientos con su Definition of Done, convenciones de commits y ramas, y skills.`,
    "",
    "- Al empezar, llama a `get_project_context` del servidor MCP `agent-tracking`. Si no reconoce el proyecto, pásale `project` con la ruta de este repositorio.",
    "- Al terminar, llama una vez a `submit_report` con lo que hiciste, por requerimiento y feature: archivos, funciones o tipos, tests y criterios del DoD cumplidos.",
    "- Si cambiaste una vista de la app, guarda una captura y repórtala con `report_screen`.",
    ...(replyLanguageRule(s.project.replyLanguage) ? [`- ${replyLanguageRule(s.project.replyLanguage)}`] : []),
    ...(s.project.testTypes?.length
      ? [`- Escribe tests ${s.project.testTypes.map((t) => testTypeLabel(t).toLowerCase()).join(", ")} para lo que construyas y repórtalos con su resultado.`]
      : []),
    ...(s.project.structure === "monorepo" && s.project.parts?.length
      ? [`- Es un monorepo: cada pieza vive en su carpeta (${s.project.parts.map((x) => `\`${x.path}\``).join(", ")}). Mira en CONTEXT.md cuál toca cada requerimiento.`]
      : []),
    "",
    "### Git",
    "",
    ...GIT_WORK_RULES.map((l) => `- ${l}`),
    ...(skills.length ? ["- Skills del proyecto (léelas cuando apliquen):", ...skills.map((k) => `  - \`${sharedSkillPath(k.name)}/SKILL.md\`: ${k.description}`)] : []),
    BLOCK_END,
  ].join("\n");
}

/** Puts the block in `text` (replacing an older one), or takes it out when `block` is null. */
export function withManagedBlock(text: string | null, block: string | null): string | null {
  const current = text ?? "";
  const start = current.indexOf(BLOCK_START);
  const end = current.indexOf(BLOCK_END);
  const without = start >= 0 && end > start ? `${current.slice(0, start)}${current.slice(end + BLOCK_END.length)}`.replace(/\n{3,}/g, "\n\n").trim() : current.trim();
  if (!block) return without ? `${without}\n` : text === null ? null : "";
  return without ? `${without}\n\n${block}\n` : `${block}\n`;
}
