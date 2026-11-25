import { PLATFORMS, type Platform, type RequirementArea, type RequirementType } from "./types";
import { isProjectKind, PROJECT_KIND_INFO, PROJECT_KINDS, type ProjectKind } from "./project-kind";
import { readClassification, settleClassification } from "./requirements";

/**
 * Plain formats for writing requirements (and whole project plans) outside the app: Markdown that
 * reads well on its own, or JSON. Both turn into the same structure; anything missing is inferred.
 */
export type ImportedRequirement = {
  title: string;
  description: string;
  type: RequirementType;
  area: RequirementArea;
  dod: string[];
};

export type ProjectPlan = {
  name: string;
  goal: string;
  kind: ProjectKind | null;
  platforms: Platform[];
  stack: string[];
  databases: string[];
  rules: string[];
  requirements: ImportedRequirement[];
};

export type ParseOutcome<T> = { ok: true; value: T; warnings: string[] } | { ok: false; error: string };

const norm = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
const list = (value: string) =>
  value
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Headings that hold the Definition of Done of the requirement above them. */
const DOD_HEADING = /^(dod|definition of done|definicion de (hecho|terminado)|criterios?( de aceptacion| de terminado)?|acceptance criteria|aceptacion)\b/;
const TAG = /\s*\[([^\]]+)\]\s*$/;

type RawRequirement = { title: string; description?: unknown; type?: unknown; area?: unknown; tags?: unknown; dod?: unknown };

const asText = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function settle(raw: RawRequirement, kind: ProjectKind, warnings: string[]): ImportedRequirement | null {
  const title = asText(raw.title);
  if (!title) return null;
  const description = asText(raw.description);
  const words = [asText(raw.type), asText(raw.area), ...(Array.isArray(raw.tags) ? raw.tags.map(asText) : [])].filter(Boolean);
  const given = readClassification(words);
  const unknown = words.filter((w) => {
    const r = readClassification([w]);
    return !r.type && !r.area;
  });
  if (unknown.length) warnings.push(`"${title}": no reconozco ${unknown.map((u) => `"${u}"`).join(", ")} como tipo o área; lo deduje del texto.`);
  const dod = (Array.isArray(raw.dod) ? raw.dod : [])
    .map((d) => (typeof d === "string" ? d : asText((d as { criterion?: unknown; criterio?: unknown })?.criterion ?? (d as { criterio?: unknown })?.criterio)))
    .map((d) => d.trim())
    .filter(Boolean);
  return { title, description, ...settleClassification(given, title, description, kind), dod };
}

/** `{ title | titulo, description | descripcion, type | tipo, area | área, dod | criterios }` in any of its spellings. */
function fromJsonItem(item: unknown): RawRequirement | null {
  if (typeof item === "string") return { title: item };
  if (!item || typeof item !== "object") return null;
  const o = Object.fromEntries(Object.entries(item as Record<string, unknown>).map(([k, v]) => [norm(k), v]));
  return {
    title: o.title ?? o.titulo ?? o.nombre ?? o.name,
    description: o.description ?? o.descripcion ?? o.detalle,
    type: o.type ?? o.tipo,
    area: o.area ?? o.categoria ?? o.category,
    tags: o.tags ?? o.etiquetas,
    dod: o.dod ?? o.criterios ?? o.criteria ?? o["definition of done"] ?? o.definitionofdone ?? o.aceptacion ?? o.acceptance,
  } as RawRequirement;
}

/** Splits Markdown into requirement blocks: the heading level used most often below the top title. */
function markdownRequirements(lines: string[]): RawRequirement[] {
  const headings = lines.map((l) => /^(#{1,6})\s+(.*)$/.exec(l)).filter((m): m is RegExpExecArray => !!m);
  const candidate = headings.filter((m) => !DOD_HEADING.test(norm(m[2]!.replace(TAG, ""))));
  if (candidate.length === 0) return [];
  const counts = new Map<number, number>();
  for (const m of candidate) counts.set(m[1]!.length, (counts.get(m[1]!.length) ?? 0) + 1);
  // A single top heading followed by others is the document title, not a requirement.
  const levels = [...counts.keys()].sort((a, b) => a - b);
  const level = levels.length > 1 && counts.get(levels[0]!) === 1 ? levels[1]! : levels[0]!;

  const out: (RawRequirement & { body: string[]; dodLines: string[] })[] = [];
  let current: (typeof out)[number] | null = null;
  let inDod = false;
  for (const line of lines) {
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h && h[1]!.length <= level) {
      inDod = false;
      if (h[1]!.length < level) {
        current = null;
        continue;
      }
      const tag = TAG.exec(h[2]!);
      const title = h[2]!.replace(TAG, "").replace(/^(requerimiento|requisito|requirement|rf|rnf)[\s\d.:-]*[:.-]\s*/i, "").trim();
      current = { title, tags: tag ? list(tag[1]!) : [], body: [], dodLines: [] };
      out.push(current);
      continue;
    }
    if (!current) continue;
    if (h) {
      inDod = DOD_HEADING.test(norm(h[2]!));
      continue;
    }
    const kv = /^\s*(?:[-*]\s*)?\*{0,2}(tipo|type|area|área|categoria|categoría)\*{0,2}\s*:\s*(.+)$/i.exec(line);
    if (kv) {
      (current.tags as string[]).push(...list(kv[2]!));
      continue;
    }
    const label = /^\s*\*{0,2}(dod|definition of done|criterios?(?: de aceptaci[oó]n)?|acceptance criteria)\s*:?\s*\*{0,2}\s*:?\s*$/i.exec(line);
    if (label) {
      inDod = true;
      continue;
    }
    const item = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?(.*)$/.exec(line);
    if (item) {
      // Checklists always count as criteria; plain bullets do once a DoD section started, or when nothing else is there.
      if (inDod || /^\s*[-*+]\s+\[[ xX]\]/.test(line)) current.dodLines.push(item[1]!.trim());
      else current.body.push(line.trim());
      continue;
    }
    if (line.trim()) current.body.push(line.trim());
  }
  return out.map(({ body, dodLines, ...r }) => {
    const bullets = body.filter((l) => /^[-*+]\s|^\d+[.)]\s/.test(l));
    const prose = body.filter((l) => !bullets.includes(l));
    const dod = dodLines.length ? dodLines : bullets.map((b) => b.replace(/^(?:[-*+]|\d+[.)])\s+/, ""));
    return { ...r, description: (dodLines.length ? body : prose).join(" ").replace(/\s+/g, " ").trim(), dod };
  });
}

const looksJson = (text: string) => /^\s*[[{]/.test(text);

/** Requirements with their Definition of Done from Markdown or JSON. */
export function parseRequirements(text: string, kind: ProjectKind = "fullstack"): ParseOutcome<ImportedRequirement[]> {
  const warnings: string[] = [];
  let raw: RawRequirement[];
  if (looksJson(text)) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: `El JSON no es válido: ${(e as Error).message}` };
    }
    const items = Array.isArray(data) ? data : ((data as Record<string, unknown>)?.requirements ?? (data as Record<string, unknown>)?.requerimientos);
    if (!Array.isArray(items)) return { ok: false, error: "El JSON debe ser una lista de requerimientos o un objeto con la lista en \"requirements\"." };
    raw = items.map(fromJsonItem).filter((x): x is RawRequirement => !!x);
  } else {
    raw = markdownRequirements(text.replace(/\r\n/g, "\n").split("\n"));
  }
  const value = raw.map((r) => settle(r, kind, warnings)).filter((r): r is ImportedRequirement => !!r);
  if (value.length === 0) return { ok: false, error: "No encontré requerimientos. Usa un título por requerimiento (## Título) o una lista en JSON." };
  const noDod = value.filter((r) => r.dod.length === 0).length;
  if (noDod) warnings.push(noDod === 1 ? "1 requerimiento no tiene criterios del DoD." : `${noDod} requerimientos no tienen criterios del DoD.`);
  return { ok: true, value, warnings };
}

const KIND_WORDS: [ProjectKind, RegExp][] = [
  ["api", /^(api|servicio|backend|api o servicio)/],
  ["frontend", /^(frontend|sitio|web sin backend|sitio o app web|landing)/],
  ["fullstack", /^(full ?stack|aplicacion completa|app completa|completa)/],
  ["desktop", /^(escritorio|desktop|app de escritorio)/],
  ["mobile", /^(movil|mobile|app movil)/],
  ["cli", /^(cli|terminal|herramienta de terminal|linea de comandos)/],
  ["library", /^(libreria|library|paquete|package|sdk)/],
];
const readKind = (value: string): ProjectKind | null => {
  const v = norm(value);
  if (isProjectKind(v)) return v;
  return KIND_WORDS.find(([, re]) => re.test(v))?.[0] ?? null;
};
const PLATFORM_WORDS: Record<string, Platform> = { web: "web", escritorio: "desktop", desktop: "desktop", movil: "mobile", mobile: "mobile", ios: "mobile", android: "mobile" };

/**
 * A whole project plan in Markdown: `# Nombre`, `Tipo:`, `Plataformas:`, `Stack:`, `Bases de datos:`
 * lines, then `## Objetivo`, `## Reglas de negocio` and `## Requerimientos` sections. JSON with the
 * same fields works too.
 */
export function parseProjectPlan(text: string): ParseOutcome<ProjectPlan> {
  const warnings: string[] = [];
  const plan: ProjectPlan = { name: "", goal: "", kind: null, platforms: [], stack: [], databases: [], rules: [], requirements: [] };

  if (looksJson(text)) {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: `El JSON no es válido: ${(e as Error).message}` };
    }
    const o = Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [norm(k), v]));
    plan.name = asText(o.name ?? o.nombre);
    plan.goal = asText(o.goal ?? o.objetivo);
    plan.kind = readKind(asText(o.kind ?? o.tipo));
    const strings = (v: unknown) => (Array.isArray(v) ? v.map(asText).filter(Boolean) : typeof v === "string" ? list(v) : []);
    plan.platforms = strings(o.platforms ?? o.plataformas).map((p) => PLATFORM_WORDS[norm(p)]).filter((p): p is Platform => !!p);
    plan.stack = strings(o.stack ?? o.tecnologias);
    plan.databases = strings(o.databases ?? o["bases de datos"] ?? o.basesdedatos);
    plan.rules = strings(o.rules ?? o.reglas ?? o["reglas de negocio"]);
    const reqs = o.requirements ?? o.requerimientos;
    if (reqs !== undefined) {
      const parsed = parseRequirements(JSON.stringify(reqs), plan.kind ?? "fullstack");
      if (parsed.ok) (plan.requirements = parsed.value), warnings.push(...parsed.warnings);
      else warnings.push(parsed.error);
    }
  } else {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    let section: "head" | "goal" | "rules" | "requirements" | "other" = "head";
    const goal: string[] = [];
    const reqLines: string[] = [];
    for (const line of lines) {
      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h && h[1]!.length === 1 && !plan.name) {
        plan.name = h[2]!.trim();
        continue;
      }
      if (h && h[1]!.length === 2) {
        const t = norm(h[2]!);
        section = /^(objetivo|goal|proposito)/.test(t)
          ? "goal"
          : /^(reglas|business rules|reglas de negocio)/.test(t)
            ? "rules"
            : /^(requerimientos|requisitos|requirements|historias)/.test(t)
              ? "requirements"
              : "other";
        continue;
      }
      if (section === "requirements") {
        reqLines.push(line);
        continue;
      }
      const kv = /^\s*(?:[-*]\s*)?\*{0,2}([\p{L} ]+?)\*{0,2}\s*:\s*(.+)$/u.exec(line);
      if (section === "head" && kv) {
        const key = norm(kv[1]!);
        const value = kv[2]!.trim();
        if (/^(nombre|name|proyecto)$/.test(key)) plan.name = value;
        else if (/^(tipo|kind|tipo de proyecto)$/.test(key)) {
          plan.kind = readKind(value);
          if (!plan.kind) warnings.push(`No reconozco el tipo de proyecto "${value}".`);
        } else if (/^(plataformas?|platforms?)$/.test(key))
          plan.platforms = list(value).map((p) => PLATFORM_WORDS[norm(p)]).filter((p): p is Platform => !!p);
        else if (/^(stack|tecnologias)$/.test(key)) plan.stack = list(value);
        else if (/^(bases? de datos|databases?|bd)$/.test(key)) plan.databases = list(value);
        else if (/^(objetivo|goal)$/.test(key)) plan.goal = value;
        continue;
      }
      if (section === "goal" && line.trim()) goal.push(line.trim());
      if (section === "rules") {
        const item = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
        if (item) plan.rules.push(item[1]!.trim());
      }
    }
    if (goal.length) plan.goal = goal.join(" ");
    // Requirement headings sit one level below "## Requerimientos"; shift them up for the parser.
    if (reqLines.some((l) => l.trim())) {
      const parsed = parseRequirements(reqLines.join("\n"), plan.kind ?? "fullstack");
      if (parsed.ok) (plan.requirements = parsed.value), warnings.push(...parsed.warnings);
      else warnings.push(parsed.error);
    }
  }
  plan.platforms = [...new Set(plan.platforms)].filter((p) => (PLATFORMS as readonly string[]).includes(p));
  return { ok: true, value: plan, warnings };
}

/** What the wizard needs from a person before a project can be created, as questions to ask. */
export type MissingField = { field: string; question: string; options?: string[] };

export function missingPlanFields(plan: ProjectPlan): MissingField[] {
  const missing: MissingField[] = [];
  if (!plan.name.trim()) missing.push({ field: "name", question: "¿Cómo se llama el proyecto?" });
  if (!plan.kind)
    missing.push({
      field: "kind",
      question: "¿Qué tipo de proyecto es?",
      options: PROJECT_KINDS.map((k) => `${k}: ${PROJECT_KIND_INFO[k].label} (${PROJECT_KIND_INFO[k].description})`),
    });
  else if (PROJECT_KIND_INFO[plan.kind].platforms === null && plan.platforms.length === 0)
    missing.push({ field: "platforms", question: "¿En qué plataformas se usa la aplicación?", options: ["web", "desktop", "mobile"] });
  if (!plan.goal.trim()) missing.push({ field: "goal", question: "¿Cuál es el objetivo del proyecto, en una o dos frases?" });
  if (plan.requirements.length === 0) missing.push({ field: "requirements", question: "¿Qué debe hacer el proyecto? Necesito al menos un requerimiento." });
  else {
    const empty = plan.requirements.filter((r) => r.dod.length === 0).map((r) => r.title);
    if (empty.length)
      missing.push({
        field: "dod",
        question: `¿Cómo sabremos que estos requerimientos están terminados? Faltan criterios del Definition of Done en: ${empty.join("; ")}.`,
      });
  }
  return missing;
}

/** An example to copy, shown in the app and returned to agents. */
export const PLAN_TEMPLATE = `# Mis gastos

Tipo: API o servicio
Plataformas: web
Stack: TypeScript, Bun, Hono, Drizzle ORM
Bases de datos: PostgreSQL

## Objetivo

Registrar gastos personales por categoría y ver cuánto se gasta cada mes.

## Reglas de negocio

- Los montos se guardan en centavos.
- Cada gasto pertenece a una sola categoría.

## Requerimientos

### Registrar gastos [funcional, backend]

POST /expenses con monto, categoría y fecha.

- [ ] Un monto de 0 o negativo devuelve 400.
- [ ] Responde 201 con el gasto creado.

### Responde rápido [no funcional, rendimiento]

- [ ] El p95 de GET /expenses es menor a 200 ms con 10 000 gastos.
`;

export const REQUIREMENTS_TEMPLATE = PLAN_TEMPLATE.slice(PLAN_TEMPLATE.indexOf("### Registrar")).replaceAll("### ", "## ");
