/**
 * How commits (and branches) are written in a project. Categories are the commit types; the person
 * picks the ones that apply and can add their own rules. Without any choice, the defaults below
 * (Conventional Commits) apply.
 */
export type CommitType = { type: string; description: string; branch: string };

export type CommitConventions = {
  /** Commit types that apply, by `type`. */
  types: string[];
  /** Whether a scope in parentheses is expected: feat(api): ... */
  scope: "optional" | "required" | "none";
  language: "es" | "en";
  /** Rules written by the person, one per line. */
  custom: string;
};

export const COMMIT_TYPES: CommitType[] = [
  { type: "feat", description: "Una funcionalidad nueva", branch: "feat/" },
  { type: "fix", description: "Corrige un error", branch: "fix/" },
  { type: "docs", description: "Solo documentación", branch: "docs/" },
  { type: "style", description: "Formato, espacios o punto y coma, sin cambiar la lógica", branch: "style/" },
  { type: "refactor", description: "Cambia el código sin corregir errores ni agregar funciones", branch: "refactor/" },
  { type: "perf", description: "Mejora el rendimiento", branch: "perf/" },
  { type: "test", description: "Agrega o corrige tests", branch: "test/" },
  { type: "build", description: "Build o dependencias", branch: "build/" },
  { type: "ci", description: "Configuración de integración continua", branch: "ci/" },
  { type: "chore", description: "Tareas de mantenimiento que no tocan el código de la app", branch: "chore/" },
  { type: "revert", description: "Revierte un commit anterior", branch: "revert/" },
];

export const DEFAULT_COMMIT_CONVENTIONS: CommitConventions = {
  types: COMMIT_TYPES.map((t) => t.type),
  scope: "optional",
  language: "es",
  custom: "",
};

/** The conventions in force: the project's, or the defaults when it set none. */
export const effectiveConventions = (c: CommitConventions | null | undefined): CommitConventions => c ?? DEFAULT_COMMIT_CONVENTIONS;

/**
 * How an agent works with git in any project tracked by Agent Tracking. The dangerous commands are
 * also stopped by the hooks (see gitGuard in @agent-tracking/agents); this tells the agent why.
 */
export const GIT_WORK_RULES = [
  "Antes de cambiar código, crea una rama desde la rama actual con `git switch -c <tipo>/<tema>` (por ejemplo `feat/exportar-csv`), salvo que ya estés en una rama de trabajo.",
  "Haz commits pequeños mientras avanzas y uno al terminar cada tarea, con el formato de estas convenciones. No dejes el trabajo sin commit.",
  "Nunca borres, renombres, recrees ni reescribas `main` o `master` (ni la rama principal del remoto): nada de `git branch -D`, `git push --force`, `git push --delete`, `git checkout --orphan` ni `git reset --hard` sobre ella.",
  "No uses `git clean -f`, `git filter-branch` ni comandos que descarten trabajo ajeno. Si algo sobra, bórralo por su nombre.",
  "No hagas push ni fusiones a main salvo que te lo pidan.",
];

/** Markdown for CONTEXT.md, so every agent writes commits and branches the same way. */
export function conventionsMarkdown(c: CommitConventions | null | undefined): string[] {
  const conv = effectiveConventions(c);
  const types = COMMIT_TYPES.filter((t) => conv.types.includes(t.type));
  const head =
    conv.scope === "required" ? "<tipo>(<alcance>): <descripción>" : conv.scope === "none" ? "<tipo>: <descripción>" : "<tipo>(<alcance opcional>): <descripción>";
  const out = [
    c ? "" : "_No se definieron convenciones: se usan Conventional Commits por defecto._",
    "",
    `- **Formato del mensaje:** \`${head}\`, en ${conv.language === "es" ? "español" : "inglés"}, en imperativo y sin punto final.`,
    `- **Ramas:** \`<tipo>/<tema-corto>\`, por ejemplo \`${types[0]?.branch ?? "feat/"}busqueda-por-fecha\`. No se trabaja directo en main.`,
    "- **Tipos permitidos:**",
    ...types.map((t) => `  - \`${t.type}\`: ${t.description}`),
  ];
  const custom = conv.custom
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (custom.length) out.push("- **Reglas del equipo:**", ...custom.map((l) => `  - ${l.replace(/^[-*]\s*/, "")}`));
  out.push("- **Trabajo con git:**", ...GIT_WORK_RULES.map((l) => `  - ${l}`));
  return out.filter((l, i) => i > 0 || l);
}
