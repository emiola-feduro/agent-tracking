import { projectProgress, requirementProgress, toPercent } from "./progress";
import type { ProjectSnapshot } from "./types";

const PLATFORM_LABEL = { web: "Web", desktop: "Escritorio", mobile: "Móvil" } as const;

const DOD_MARK = { done: "x", pending: " ", failed: "!" } as const;

/**
 * Genera el CONTEXT.md: todo lo que otro agente necesita para incorporarse al proyecto.
 * Determinista (sin fechas) para que el archivo solo cambie cuando cambia el contenido.
 */
export function buildContextMarkdown(s: ProjectSnapshot): string {
  const { project: p } = s;
  const out: string[] = [];
  out.push(`# ${p.name}`, "");
  out.push(
    `> Contexto generado por Agent Tracking. Léelo completo antes de trabajar en este proyecto.`,
    `> La fuente de verdad es \`.agent-tracking/project.json\`; este archivo se regenera a partir de él.`,
    "",
  );

  out.push("## Objetivo", "", p.goal.trim() || "_Sin definir._", "");

  out.push("## Ficha técnica", "");
  out.push(`- **Plataformas:** ${p.platforms.map((x) => PLATFORM_LABEL[x]).join(", ") || "_Sin definir_"}`);
  out.push(`- **Stack:** ${p.stack.length ? p.stack.join(", ") : "_Sin definir_"}`);
  out.push(`- **Bases de datos:** ${p.databases.length ? p.databases.join(", ") : "_Sin definir_"}`);
  if (p.repoUrl) out.push(`- **Repositorio:** ${p.repoUrl}`);
  out.push(`- **Avance global:** ${toPercent(projectProgress(s))}%`, "");

  out.push("## Reglas de negocio", "");
  if (s.rules.length === 0) out.push("_No hay reglas definidas._");
  [...s.rules]
    .sort((a, b) => a.priority - b.priority)
    .forEach((r, i) => out.push(`${i + 1}. ${r.text}`));
  out.push("");

  const skills = s.skills.filter((k) => k.enabled);
  out.push("## Skills a usar", "");
  if (skills.length === 0) out.push("_No se seleccionaron skills._");
  for (const k of skills) out.push(`- **${k.name}** (${k.source}) — ${k.description}`);
  out.push("");

  out.push("## Requerimientos", "");
  if (s.requirements.length === 0) out.push("_No hay requerimientos definidos._", "");
  for (const r of s.requirements) {
    out.push(`### ${r.title} — ${toPercent(requirementProgress(s, r.id))}%`, "");
    out.push(`ID: \`${r.id}\``, "");
    if (r.description.trim()) out.push(r.description.trim(), "");
    const dod = s.dod.filter((d) => d.requirementId === r.id);
    out.push("**Definition of Done:**", "");
    if (dod.length === 0) out.push("_Sin criterios._");
    for (const d of dod) out.push(`- [${DOD_MARK[d.status]}] ${d.criterion} (\`${d.id}\`)`);
    out.push("");
    const features = s.features.filter((f) => f.requirementId === r.id);
    if (features.length) {
      out.push("**Features:**", "");
      for (const f of features) {
        out.push(`- ${f.name} — _${f.status}_ (\`${f.id}\`)`);
        const fileIds = new Set(s.featureFiles.filter((l) => l.featureId === f.id).map((l) => l.fileId));
        for (const file of s.files.filter((x) => fileIds.has(x.id))) {
          out.push(`  - \`${file.path}\`${file.purpose ? `: ${file.purpose}` : ""}`);
        }
      }
      out.push("");
    }
  }

  const pending = s.testIdeas.filter((t) => t.status === "proposed" || t.status === "accepted");
  if (pending.length) {
    out.push("## Ideas de tests pendientes", "");
    for (const t of pending) out.push(`- ${t.text} (\`${t.id}\`)`);
    out.push("");
  }

  out.push("## Cómo reportar tu trabajo", "");
  out.push(
    "Este proyecto se rastrea vía el servidor MCP de Agent Tracking. Antes de empezar un feature llama a `start_feature`;",
    "reporta cada archivo con `report_file`, sus funciones/variables con `report_symbol`, los tests con `report_test`",
    "y marca los criterios del DoD con `mark_dod_item` cuando tengas evidencia. Al terminar llama a `complete_feature`.",
    "Si se te ocurre un caso que valga la pena probar y no vas a escribirlo ahora, regístralo con `suggest_test_idea`.",
    "",
  );
  return out.join("\n");
}
