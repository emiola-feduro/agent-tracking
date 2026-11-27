import { PLATFORMS, type Platform, type RequirementArea, type RequirementType, type TestType } from "./types";
import { isProjectKind, PROJECT_KIND_INFO, PROJECT_KINDS, type ProjectKind } from "./project-kind";
import { readClassification, settleClassification } from "./requirements";
import { MONOREPO_TOOLS, partPlatforms, partsProblems, slugify, suggestPartPath, summarizeParts, type ProjectPart, type ProjectStructure } from "./parts";
import { TEST_POLICY_TYPES } from "./test-policy";
import { REPLY_LANGUAGE_INFO, REPLY_LANGUAGES, type ReplyLanguage } from "./reply-language";

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
  /** Pieces it touches, as written (name, folder or id); a project plan turns them into part ids. */
  parts?: string[];
};

/** A piece of a monorepo as a plan describes it; the kind stays null when the plan does not say it. */
export type PlanPart = Omit<ProjectPart, "kind"> & { kind: ProjectKind | null };

export type ProjectPlan = {
  name: string;
  goal: string;
  kind: ProjectKind | null;
  platforms: Platform[];
  stack: string[];
  databases: string[];
  rules: string[];
  /** Text under "## Convenciones de commits"; empty means the defaults. */
  conventions: string;
  requirements: ImportedRequirement[];
  /** "monorepo" when the plan says so or lists pieces under "## Piezas". */
  structure: ProjectStructure;
  parts: PlanPart[];
  /** Id from MONOREPO_TOOLS; null means the recommended one for the pieces. */
  monorepoTool: string | null;
  /** Tests agents must write; null means the defaults for the kind of project. */
  testTypes: TestType[] | null;
  /** Language of the agents' answers; null for none, undefined when the plan does not say (the default). */
  replyLanguage?: ReplyLanguage | null;
};

export type ParseOutcome<T> = { ok: true; value: T; warnings: string[] } | { ok: false; error: string };

const norm = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
const list = (value: string) =>
  value
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Headings that hold the Definition of Done of the requirement above them. */
const DOD_HEADING =
  /^(dod|definition of done|definicion de (hecho|terminado)|criterios?( de aceptacion| de terminado)?|acceptance criteria|aceptacion)\b/;
const TAG = /\s*\[([^\]]+)\]\s*$/;

type RawRequirement = { title: string; description?: unknown; type?: unknown; area?: unknown; tags?: unknown; dod?: unknown; parts?: unknown };

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
  if (unknown.length)
    warnings.push(`"${title}": no reconozco ${unknown.map((u) => `"${u}"`).join(", ")} como tipo o área; lo deduje del texto.`);
  const dod = (Array.isArray(raw.dod) ? raw.dod : [])
    .map((d) =>
      typeof d === "string"
        ? d
        : asText((d as { criterion?: unknown; criterio?: unknown })?.criterion ?? (d as { criterio?: unknown })?.criterio),
    )
    .map((d) => d.trim())
    .filter(Boolean);
  const parts = (Array.isArray(raw.parts) ? raw.parts.map(asText) : typeof raw.parts === "string" ? list(raw.parts) : []).filter(Boolean);
  return { title, description, ...settleClassification(given, title, description, kind), dod, ...(parts.length ? { parts } : {}) };
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
    parts: o.parts ?? o.piezas ?? o.pieces,
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
      const title = h[2]!
        .replace(TAG, "")
        .replace(/^(requerimiento|requisito|requirement|rf|rnf)[\s\d.:-]*[:.-]\s*/i, "")
        .trim();
      current = { title, tags: tag ? list(tag[1]!) : [], parts: [], body: [], dodLines: [] };
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
    const pieces = /^\s*(?:[-*]\s*)?\*{0,2}(piezas?|parts?|pieces?)\*{0,2}\s*:\s*(.+)$/i.exec(line);
    if (pieces) {
      (current.parts as string[]).push(...list(pieces[2]!));
      continue;
    }
    const label = /^\s*\*{0,2}(dod|definition of done|criterios?(?: de aceptaci[oó]n)?|acceptance criteria)\s*:?\s*\*{0,2}\s*:?\s*$/i.exec(
      line,
    );
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
    const items = Array.isArray(data)
      ? data
      : ((data as Record<string, unknown>)?.requirements ?? (data as Record<string, unknown>)?.requerimientos);
    if (!Array.isArray(items))
      return { ok: false, error: 'El JSON debe ser una lista de requerimientos o un objeto con la lista en "requirements".' };
    raw = items.map(fromJsonItem).filter((x): x is RawRequirement => !!x);
  } else {
    raw = markdownRequirements(text.replace(/\r\n/g, "\n").split("\n"));
  }
  const value = raw.map((r) => settle(r, kind, warnings)).filter((r): r is ImportedRequirement => !!r);
  if (value.length === 0)
    return { ok: false, error: "No encontré requerimientos. Usa un título por requerimiento (## Título) o una lista en JSON." };
  const noDod = value.filter((r) => r.dod.length === 0).length;
  if (noDod)
    warnings.push(noDod === 1 ? "1 requerimiento no tiene criterios del DoD." : `${noDod} requerimientos no tienen criterios del DoD.`);
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
  ["app", /^(app multiplataforma|multiplataforma|multiplatform)/],
];
const readKind = (value: string): ProjectKind | null => {
  const v = norm(value);
  if (isProjectKind(v)) return v;
  return KIND_WORDS.find(([, re]) => re.test(v))?.[0] ?? null;
};
const PLATFORM_WORDS: Record<string, Platform> = {
  web: "web",
  escritorio: "desktop",
  desktop: "desktop",
  movil: "mobile",
  mobile: "mobile",
  ios: "mobile",
  android: "mobile",
};
const readPlatforms = (values: string[]) => values.map((p) => PLATFORM_WORDS[norm(p)]).filter((p): p is Platform => !!p);

const TEST_WORDS: [TestType, RegExp][] = [
  ["unit", /^(unit|unitarios?|unidad)/],
  ["integration", /^(integration|integracion)/],
  ["component", /^(component|componentes?)/],
  ["e2e", /^(e2e|end ?to ?end|extremo a extremo)/],
  ["contract", /^(contract|contratos?)/],
  ["performance", /^(performance|rendimiento|carga)/],
  ["other", /^(other|otros?)/],
];
function readTestTypes(values: string[], warnings: string[]): TestType[] {
  const out: TestType[] = [];
  for (const value of values) {
    const v = norm(value);
    const type = TEST_POLICY_TYPES.find((t) => norm(t.label) === v)?.type ?? TEST_WORDS.find(([, re]) => re.test(v))?.[0];
    if (type) out.push(type);
    else warnings.push(`No reconozco el tipo de test "${value}".`);
  }
  return [...new Set(out)];
}

/** "es", "español", "English"; "ninguno" means no language. Undefined when it is not recognised. */
function readReplyLanguage(value: string, warnings: string[]): ReplyLanguage | null | undefined {
  const v = norm(value);
  if (/^(ninguno|ninguna|none|sin indicar|no)$/.test(v)) return null;
  const lang = REPLY_LANGUAGES.find(
    (l) => l === v || norm(REPLY_LANGUAGE_INFO[l].label) === v || norm(REPLY_LANGUAGE_INFO[l].native) === v,
  );
  if (lang) return lang;
  warnings.push(`No reconozco el idioma "${value}"; se usa el de siempre. Opciones: ${REPLY_LANGUAGES.join(", ")} o ninguno.`);
  return undefined;
}

function readStructure(value: string, warnings: string[]): ProjectStructure | null {
  const v = norm(value);
  if (/^(monorepo|varias piezas|multi)/.test(v)) return "monorepo";
  if (/^(single|una sola|un solo|simple|una app|app unica)/.test(v)) return "single";
  warnings.push(`No reconozco la estructura "${value}" (usa monorepo o una sola app).`);
  return null;
}

function readMonorepoTool(value: string, warnings: string[]): string | null {
  const v = norm(value);
  const tool = MONOREPO_TOOLS.find((t) => t.id === v || norm(t.label) === v);
  if (!tool) warnings.push(`No reconozco la herramienta de monorepo "${value}"; se usará la recomendada para sus piezas.`);
  return tool?.id ?? null;
}

type RawPart = { name: string; kind?: string; path?: string; platforms?: string[]; stack?: string[] };

function fromJsonPart(item: unknown): RawPart | null {
  if (typeof item === "string") return { name: item };
  if (!item || typeof item !== "object") return null;
  const o = Object.fromEntries(Object.entries(item as Record<string, unknown>).map(([k, v]) => [norm(k), v]));
  const strings = (v: unknown) => (Array.isArray(v) ? v.map(asText).filter(Boolean) : typeof v === "string" ? list(v) : []);
  return {
    name: asText(o.name ?? o.nombre),
    kind: asText(o.kind ?? o.tipo),
    path: asText(o.path ?? o.carpeta ?? o.ruta ?? o.folder),
    platforms: strings(o.platforms ?? o.plataformas),
    stack: strings(o.stack ?? o.tecnologias),
  };
}

/** Pieces with an id, a folder and only the platforms their kind allows. */
function settleParts(raw: RawPart[], warnings: string[]): PlanPart[] {
  const out: PlanPart[] = [];
  for (const r of raw) {
    const name = r.name.trim();
    if (!name) continue;
    const kind = r.kind ? readKind(r.kind) : null;
    if (r.kind && !kind) warnings.push(`Pieza "${name}": no reconozco el tipo "${r.kind}".`);
    let id = slugify(name);
    for (let i = 2; out.some((p) => p.id === id); i++) id = `${slugify(name)}-${i}`;
    const path = r.path?.trim().replace(/\/+$/, "") || suggestPartPath(kind ?? "fullstack", name, out.map((p) => p.path));
    const platforms = [...new Set(readPlatforms(r.platforms ?? []))];
    out.push({ id, name, kind, path, platforms: kind ? partPlatforms({ kind, platforms }) : platforms, stack: r.stack ?? [] });
  }
  return out;
}

/** Pieces as written in a requirement (name, folder or id) to part ids; unknown ones become warnings. */
function linkRequirementParts(plan: ProjectPlan, warnings: string[]) {
  const find = (ref: string) => plan.parts.find((p) => [p.id, norm(p.name), p.path.toLowerCase()].includes(norm(ref)) || slugify(ref) === p.id);
  for (const r of plan.requirements) {
    if (!r.parts) continue;
    const ids: string[] = [];
    for (const ref of r.parts) {
      const part = find(ref);
      if (part) ids.push(part.id);
      else warnings.push(`"${r.title}": no hay una pieza "${ref}".`);
    }
    r.parts = [...new Set(ids)];
  }
}

/**
 * A whole project plan in Markdown: `# Nombre`, `Tipo:`, `Plataformas:`, `Stack:`, `Bases de datos:`
 * lines, then `## Objetivo`, `## Reglas de negocio` and `## Requerimientos` sections. JSON with the
 * same fields works too.
 */
export function parseProjectPlan(text: string): ParseOutcome<ProjectPlan> {
  const warnings: string[] = [];
  const plan: ProjectPlan = {
    name: "",
    goal: "",
    kind: null,
    platforms: [],
    stack: [],
    databases: [],
    rules: [],
    conventions: "",
    requirements: [],
    structure: "single",
    parts: [],
    monorepoTool: null,
    testTypes: null,
  };
  let explicitStructure: ProjectStructure | null = null;
  const parts: RawPart[] = [];

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
    plan.platforms = strings(o.platforms ?? o.plataformas)
      .map((p) => PLATFORM_WORDS[norm(p)])
      .filter((p): p is Platform => !!p);
    plan.stack = strings(o.stack ?? o.tecnologias);
    plan.databases = strings(o.databases ?? o["bases de datos"] ?? o.basesdedatos);
    plan.rules = strings(o.rules ?? o.reglas ?? o["reglas de negocio"]);
    plan.conventions = strings(o.conventions ?? o.convenciones ?? o["commit conventions"]).join("\n");
    const structure = asText(o.structure ?? o.estructura);
    if (structure) explicitStructure = readStructure(structure, warnings);
    const rawParts = o.parts ?? o.piezas ?? o.pieces;
    if (Array.isArray(rawParts)) parts.push(...rawParts.map(fromJsonPart).filter((x): x is RawPart => !!x));
    const tool = asText(o.monorepotool ?? o["monorepo tool"] ?? o["herramienta de monorepo"] ?? o.herramienta);
    if (tool) plan.monorepoTool = readMonorepoTool(tool, warnings);
    const tests = o.testtypes ?? o["test types"] ?? o.tests ?? o["tipos de tests"] ?? o["tipos de test"];
    if (tests !== undefined) plan.testTypes = readTestTypes(strings(tests), warnings);
    const lang = o.replylanguage ?? o["reply language"] ?? o.language ?? o.idioma ?? o["idioma de las respuestas"];
    if (lang === null) plan.replyLanguage = null;
    else if (typeof lang === "string" && lang.trim()) plan.replyLanguage = readReplyLanguage(lang, warnings);
    const reqs = o.requirements ?? o.requerimientos;
    if (reqs !== undefined) {
      const parsed = parseRequirements(JSON.stringify(reqs), plan.kind ?? "fullstack");
      if (parsed.ok) ((plan.requirements = parsed.value), warnings.push(...parsed.warnings));
      else warnings.push(parsed.error);
    }
  } else {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    let section: "head" | "goal" | "rules" | "conventions" | "parts" | "requirements" | "other" = "head";
    let part: RawPart | null = null;
    const conventions: string[] = [];
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
          : /^(convenciones|commit conventions|commits)/.test(t)
            ? "conventions"
            : /^(reglas|business rules|reglas de negocio)/.test(t)
              ? "rules"
              : /^(requerimientos|requisitos|requirements|historias)/.test(t)
                ? "requirements"
                : /^(piezas|parts|pieces|paquetes|modulos)/.test(t)
                  ? "parts"
                  : "other";
        continue;
      }
      if (section === "requirements") {
        reqLines.push(line);
        continue;
      }
      const kv = /^\s*(?:[-*]\s*)?\*{0,2}([\p{L} ]+?)\*{0,2}\s*:\s*(.+)$/u.exec(line);
      if (section === "parts") {
        if (h) {
          part = { name: h[2]!.trim() };
          parts.push(part);
        } else if (kv && part) {
          const key = norm(kv[1]!);
          const value = kv[2]!.trim();
          if (/^(tipo|kind)$/.test(key)) part.kind = value;
          else if (/^(carpeta|ruta|path|folder|directorio)$/.test(key)) part.path = value.replace(/^`|`$/g, "");
          else if (/^(plataformas?|platforms?)$/.test(key)) part.platforms = list(value);
          else if (/^(stack|tecnologias)$/.test(key)) part.stack = list(value);
          else if (/^(nombre|name)$/.test(key)) part.name = value;
        }
        continue;
      }
      if (section === "head" && kv) {
        const key = norm(kv[1]!);
        const value = kv[2]!.trim();
        if (/^(nombre|name|proyecto)$/.test(key)) plan.name = value;
        else if (/^(tipo|kind|tipo de proyecto)$/.test(key)) {
          plan.kind = readKind(value);
          if (!plan.kind) warnings.push(`No reconozco el tipo de proyecto "${value}".`);
        } else if (/^(plataformas?|platforms?)$/.test(key))
          plan.platforms = list(value)
            .map((p) => PLATFORM_WORDS[norm(p)])
            .filter((p): p is Platform => !!p);
        else if (/^(stack|tecnologias)$/.test(key)) plan.stack = list(value);
        else if (/^(bases? de datos|databases?|bd)$/.test(key)) plan.databases = list(value);
        else if (/^(objetivo|goal)$/.test(key)) plan.goal = value;
        else if (/^(estructura|structure)$/.test(key)) explicitStructure = readStructure(value, warnings);
        else if (/^(herramienta de monorepo|herramienta|monorepo tool|monorepo)$/.test(key)) plan.monorepoTool = readMonorepoTool(value, warnings);
        else if (/^(tests|tipos de tests?|test types|pruebas)$/.test(key)) plan.testTypes = readTestTypes(list(value), warnings);
        else if (/^(idioma|idioma de las respuestas|language|reply language|lenguaje)$/.test(key)) plan.replyLanguage = readReplyLanguage(value, warnings);
        continue;
      }
      if (section === "goal" && line.trim()) goal.push(line.trim());
      if (section === "conventions" && line.trim()) conventions.push(line.trim().replace(/^[-*]\s*/, ""));
      if (section === "rules") {
        const item = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
        if (item) plan.rules.push(item[1]!.trim());
      }
    }
    if (goal.length) plan.goal = goal.join(" ");
    plan.conventions = conventions.join("\n");
    // Requirement headings sit one level below "## Requerimientos"; shift them up for the parser.
    if (reqLines.some((l) => l.trim())) {
      const parsed = parseRequirements(reqLines.join("\n"), plan.kind ?? "fullstack");
      if (parsed.ok) ((plan.requirements = parsed.value), warnings.push(...parsed.warnings));
      else warnings.push(parsed.error);
    }
  }
  plan.platforms = [...new Set(plan.platforms)].filter((p) => (PLATFORMS as readonly string[]).includes(p));
  plan.parts = settleParts(parts, warnings);
  plan.structure = explicitStructure ?? (plan.parts.length ? "monorepo" : "single");
  if (plan.structure === "single") {
    if (plan.parts.length) warnings.push("El plan dice que es una sola app: se ignoran sus piezas.");
    plan.parts = [];
    plan.monorepoTool = null;
    for (const r of plan.requirements) delete r.parts;
  } else {
    linkRequirementParts(plan, warnings);
    // As in the wizard, a monorepo is what its pieces add up to.
    const complete = plan.parts.filter((p): p is ProjectPart => p.kind !== null);
    if (complete.length && complete.length === plan.parts.length) {
      const shape = summarizeParts(complete);
      plan.kind = shape.kind;
      plan.platforms = shape.platforms;
      plan.stack = [...new Set([...plan.stack, ...shape.stack])];
    }
  }
  return { ok: true, value: plan, warnings };
}

/** What the wizard needs from a person before a project can be created, as questions to ask. */
export type MissingField = { field: string; question: string; options?: string[] };

export function missingPlanFields(plan: ProjectPlan): MissingField[] {
  const missing: MissingField[] = [];
  if (!plan.name.trim()) missing.push({ field: "name", question: "¿Cómo se llama el proyecto?" });
  const kindOptions = PROJECT_KINDS.map((k) => `${k}: ${PROJECT_KIND_INFO[k].label} (${PROJECT_KIND_INFO[k].description})`);
  if (plan.structure === "monorepo") {
    const untyped = plan.parts.filter((p) => !p.kind).map((p) => p.name);
    if (plan.parts.length === 0)
      missing.push({ field: "parts", question: "¿Qué piezas tiene el monorepo? De cada una: nombre, tipo, carpeta y stack." });
    else if (untyped.length) missing.push({ field: "parts", question: `¿De qué tipo es cada pieza? Falta en: ${untyped.join("; ")}.`, options: kindOptions });
    else {
      const problems = partsProblems(plan.parts as ProjectPart[]);
      if (problems.length) missing.push({ field: "parts", question: `Hay que corregir las piezas: ${problems.join("; ")}.` });
    }
  } else if (!plan.kind)
    missing.push({
      field: "kind",
      question: "¿Qué tipo de proyecto es?",
      options: kindOptions,
    });
  else if (PROJECT_KIND_INFO[plan.kind].platforms === null && plan.platforms.length === 0)
    missing.push({ field: "platforms", question: "¿En qué plataformas se usa la aplicación?", options: ["web", "desktop", "mobile"] });
  if (!plan.goal.trim()) missing.push({ field: "goal", question: "¿Cuál es el objetivo del proyecto, en una o dos frases?" });
  if (plan.requirements.length === 0)
    missing.push({ field: "requirements", question: "¿Qué debe hacer el proyecto? Necesito al menos un requerimiento." });
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

/** A monorepo plan: its pieces under "## Piezas", requirements pointing at them with "Piezas:". */
export const PLAN_MONOREPO_EXAMPLE = `# Turnos

Estructura: monorepo
Herramienta de monorepo: pnpm-workspaces
Tests: unitarios, integración, e2e
Idioma: español

## Objetivo

Reservar turnos en una peluquería desde el móvil y gestionarlos desde un panel.

## Piezas

### API
Tipo: api
Carpeta: apps/api
Stack: TypeScript, Hono

### Móvil
Tipo: app móvil
Carpeta: apps/mobile
Stack: Flutter, Dart

## Requerimientos

### Reservar un turno [funcional]
Piezas: API, Móvil

- [ ] La app muestra los huecos libres del día.
`;
