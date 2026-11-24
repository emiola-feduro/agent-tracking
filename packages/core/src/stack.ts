import { PROJECT_KIND_INFO, type ProjectKind } from "./project-kind";
import type { Platform } from "./types";

export type StackCategory = "frontend" | "desktop" | "mobile" | "backend" | "language" | "orm" | "testing";

/** A set of options where only one can be selected at a time. */
export type StackGroup =
  | "web-framework"
  | "desktop-shell"
  | "mobile-framework"
  | "js-runtime"
  | "backend-framework"
  | "orm"
  | "js-unit-test"
  | "web-e2e"
  | "mobile-e2e";

export type StackOption = {
  name: string;
  category: StackCategory;
  /** Platforms where the option makes sense; it is hidden for other selections. */
  platforms: Platform[];
  group?: StackGroup;
  /** Selecting this option clears these groups (and the other way around). */
  excludesGroups?: StackGroup[];
  /** Selected automatically with this option; removing them removes this option. */
  requires?: string[];
  /**
   * Only makes sense next to one of these (for example Tailwind with a web framework). It cannot be
   * picked without one and goes away when the last one is removed. Never selected automatically.
   */
  needsAny?: string[];
  /** Shown when `needsAny` is not met, completing "Necesita ...". */
  needsLabel?: string;
};

export type DatabaseKind = "relational" | "document" | "key-value" | "embedded" | "search" | "graph" | "vector" | "time-series" | "wide-column";
export type DatabaseOption = { name: string; kind: DatabaseKind; platforms: Platform[]; aliases?: string[] };

export const STACK_CATEGORY_LABEL: Record<StackCategory, string> = {
  frontend: "Frontend web",
  desktop: "Escritorio",
  mobile: "Móvil",
  backend: "Backend",
  language: "Lenguaje y runtime",
  orm: "Acceso a datos",
  testing: "Testing",
};

export const STACK_GROUP_LABEL: Record<StackGroup, string> = {
  "web-framework": "Framework",
  "desktop-shell": "Contenedor de escritorio",
  "mobile-framework": "Framework multiplataforma",
  "js-runtime": "Runtime",
  "backend-framework": "Framework de backend",
  orm: "ORM",
  "js-unit-test": "Tests unitarios",
  "web-e2e": "Tests end to end web",
  "mobile-e2e": "Tests end to end móvil",
};

/** Platforms a category belongs to (web UI frameworks also run inside desktop shells). Others always apply. */
export const CATEGORY_PLATFORM: Partial<Record<StackCategory, Platform[]>> = {
  frontend: ["web", "desktop"],
  desktop: ["desktop"],
  mobile: ["mobile"],
};

const all: Platform[] = ["web", "desktop", "mobile"];
const NOT_JS: StackGroup[] = ["js-runtime"];

/** Web UI frameworks: what Tailwind, Playwright and Cypress need. */
export const WEB_UI = ["React", "Next.js", "SvelteKit", "Vue", "Angular", "Astro"];
/** Anything written in JavaScript or TypeScript, which is when a JS runtime and JS tooling make sense. */
export const JS_BASED = ["TypeScript", ...WEB_UI, "Electron", "React Native", "Expo", "Hono", "Express", "Fastify", "NestJS"];
const MOBILE_UI = ["React Native", "Flutter", "SwiftUI", "Jetpack Compose"];

const needsWeb = { needsAny: WEB_UI, needsLabel: "un framework web" };
const needsJs = { needsAny: JS_BASED, needsLabel: "TypeScript o un framework de JavaScript" };
const needsJsOrRuntime = { needsAny: [...JS_BASED, "Bun", "Node.js", "Deno"], needsLabel: "TypeScript o un runtime de JavaScript" };

export const STACK_OPTIONS: StackOption[] = [
  { name: "React", category: "frontend", platforms: ["web", "desktop"], group: "web-framework" },
  { name: "Next.js", category: "frontend", platforms: ["web"], group: "web-framework" },
  { name: "SvelteKit", category: "frontend", platforms: ["web"], group: "web-framework" },
  { name: "Vue", category: "frontend", platforms: ["web", "desktop"], group: "web-framework" },
  { name: "Angular", category: "frontend", platforms: ["web"], group: "web-framework" },
  { name: "Astro", category: "frontend", platforms: ["web"], group: "web-framework" },
  { name: "Tailwind CSS", category: "frontend", platforms: ["web", "desktop"], ...needsWeb },

  { name: "Tauri", category: "desktop", platforms: ["desktop"], group: "desktop-shell", requires: ["Rust"] },
  { name: "Electron", category: "desktop", platforms: ["desktop"], group: "desktop-shell" },
  { name: ".NET MAUI", category: "desktop", platforms: ["desktop"], group: "desktop-shell", requires: ["C#"] },

  { name: "React Native", category: "mobile", platforms: ["mobile"], group: "mobile-framework" },
  { name: "Flutter", category: "mobile", platforms: ["mobile"], group: "mobile-framework", requires: ["Dart"] },
  { name: "Expo", category: "mobile", platforms: ["mobile"], requires: ["React Native"] },
  { name: "SwiftUI", category: "mobile", platforms: ["mobile"], excludesGroups: ["mobile-framework"], requires: ["Swift"] },
  { name: "Jetpack Compose", category: "mobile", platforms: ["mobile"], excludesGroups: ["mobile-framework"], requires: ["Kotlin"] },

  { name: "Bun", category: "language", platforms: all, group: "js-runtime", ...needsJs },
  { name: "Node.js", category: "language", platforms: all, group: "js-runtime", ...needsJs },
  { name: "Deno", category: "language", platforms: all, group: "js-runtime", ...needsJs },
  { name: "Hono", category: "backend", platforms: all, group: "backend-framework" },
  { name: "Express", category: "backend", platforms: all, group: "backend-framework" },
  { name: "Fastify", category: "backend", platforms: all, group: "backend-framework" },
  { name: "NestJS", category: "backend", platforms: all, group: "backend-framework", requires: ["TypeScript"] },
  { name: "FastAPI", category: "backend", platforms: all, group: "backend-framework", excludesGroups: NOT_JS, requires: ["Python"] },
  { name: "Django", category: "backend", platforms: all, group: "backend-framework", excludesGroups: NOT_JS, requires: ["Python"] },
  { name: "Spring Boot", category: "backend", platforms: all, group: "backend-framework", excludesGroups: NOT_JS, requires: ["Java"] },
  { name: "ASP.NET Core", category: "backend", platforms: all, group: "backend-framework", excludesGroups: NOT_JS, requires: ["C#"] },
  { name: "Gin", category: "backend", platforms: all, group: "backend-framework", excludesGroups: NOT_JS, requires: ["Go"] },

  { name: "TypeScript", category: "language", platforms: all },
  { name: "Python", category: "language", platforms: all },
  { name: "Java", category: "language", platforms: all },
  { name: "C#", category: "language", platforms: all },
  { name: "Go", category: "language", platforms: all },
  { name: "Rust", category: "language", platforms: all },
  { name: "Kotlin", category: "language", platforms: ["mobile", "web"] },
  { name: "Swift", category: "language", platforms: ["mobile"] },
  { name: "Dart", category: "language", platforms: ["mobile"] },

  { name: "Drizzle ORM", category: "orm", platforms: all, group: "orm", ...needsJsOrRuntime },
  { name: "Prisma", category: "orm", platforms: all, group: "orm", ...needsJsOrRuntime },
  { name: "TypeORM", category: "orm", platforms: all, group: "orm", ...needsJsOrRuntime },
  { name: "SQLAlchemy", category: "orm", platforms: all, group: "orm", requires: ["Python"] },
  { name: "Entity Framework", category: "orm", platforms: all, group: "orm", requires: ["C#"] },
  { name: "Hibernate", category: "orm", platforms: all, group: "orm", requires: ["Java"] },

  { name: "Vitest", category: "testing", platforms: all, group: "js-unit-test", ...needsJsOrRuntime },
  { name: "Jest", category: "testing", platforms: all, group: "js-unit-test", ...needsJsOrRuntime },
  { name: "Bun test", category: "testing", platforms: all, group: "js-unit-test", requires: ["Bun"] },
  { name: "Pytest", category: "testing", platforms: all, requires: ["Python"] },
  { name: "Playwright", category: "testing", platforms: ["web", "desktop"], group: "web-e2e", needsAny: [...WEB_UI, "Electron", "Tauri"], needsLabel: "una interfaz web o de escritorio" },
  { name: "Cypress", category: "testing", platforms: ["web"], group: "web-e2e", ...needsWeb },
  { name: "Detox", category: "testing", platforms: ["mobile"], group: "mobile-e2e", needsAny: ["React Native"], needsLabel: "React Native" },
  { name: "Maestro", category: "testing", platforms: ["mobile"], group: "mobile-e2e", needsAny: MOBILE_UI, needsLabel: "un framework móvil" },
];

const byName = (options: StackOption[]) => new Map(options.map((o) => [o.name, o]));

const conflicts = (a: StackOption, b: StackOption) =>
  (a.group !== undefined && a.group === b.group) ||
  (b.group !== undefined && !!a.excludesGroups?.includes(b.group)) ||
  (a.group !== undefined && !!b.excludesGroups?.includes(a.group));

/** Whether an option's `needsAny` is met by the selection (always true without one). */
export const stackNeedsMet = (option: Pick<StackOption, "needsAny">, selected: string[]) =>
  !option.needsAny || option.needsAny.some((n) => selected.includes(n));

/**
 * Whether an option can be added to the selection: its own `needsAny` is met and so is the one of
 * everything it requires (Bun test needs Bun, which needs TypeScript or a JS framework).
 */
export function canSelectStackOption(name: string, selected: string[], options: StackOption[] = STACK_OPTIONS): boolean {
  if (selected.includes(name)) return true;
  const option = options.find((o) => o.name === name);
  if (!option) return true;
  return stackNeedsMet(option, selected) && (option.requires ?? []).every((r) => canSelectStackOption(r, selected, options));
}

/** Drops options whose required or needed options are no longer selected (repeats until stable). */
function dropUnmetRequirements(selected: string[], index: Map<string, StackOption>): string[] {
  let out = selected;
  for (;;) {
    const next = out.filter((n) => {
      const option = index.get(n);
      return !option || ((option.requires ?? []).every((r) => out.includes(r)) && stackNeedsMet(option, out));
    });
    if (next.length === out.length) return out;
    out = next;
  }
}

function addOption(selected: string[], name: string, index: Map<string, StackOption>): string[] {
  const option = index.get(name);
  if (!option) return selected.includes(name) ? selected : [...selected, name];
  // Requirements first, so the option is never dropped for missing them.
  let out = selected.filter((n) => n !== name);
  for (const required of option.requires ?? []) if (!out.includes(required)) out = addOption(out, required, index);
  out = out.filter((n) => {
    const other = index.get(n);
    return !(other && conflicts(option, other));
  });
  // Something like Tailwind without a web framework is refused rather than added on its own.
  if (!stackNeedsMet(option, out)) return selected;
  // Checked with the new option in, so swapping React for Vue keeps Tailwind.
  return dropUnmetRequirements([...out, name], index);
}

/**
 * Selects or deselects one option while keeping the selection consistent: only one option per
 * group, excluded groups cleared, requirements added, and dependants removed with what they need.
 * Names that are not in the catalog (free text entries) are simply toggled.
 */
export function toggleStackOption(selected: string[], name: string, options: StackOption[] = STACK_OPTIONS): string[] {
  const index = byName(options);
  if (selected.includes(name)) return dropUnmetRequirements(selected.filter((n) => n !== name), index);
  return addOption(selected, name, index);
}

/**
 * Builds a consistent selection from a list of names in any order: options whose `needsAny` is not
 * met yet are retried after the rest, so ["Tailwind CSS", "React"] keeps both.
 */
export function buildStack(names: string[], options: StackOption[] = STACK_OPTIONS): string[] {
  let selected: string[] = [];
  let pending = [...new Set(names)];
  while (pending.length) {
    const retry: string[] = [];
    for (const name of pending) {
      if (selected.includes(name)) continue;
      const next = toggleStackOption(selected, name, options);
      if (next === selected) retry.push(name);
      else selected = next;
    }
    if (retry.length === pending.length) break;
    pending = retry;
  }
  return selected;
}

export type StackRecommendation = {
  stack: string[];
  databases: string[];
  rationale: string;
  alternatives: { stack: string[]; databases: string[]; when: string }[];
};

const unique = (list: string[]) => [...new Set(list)];

/**
 * Default recommendation built from the kind of project and its platforms. The LLM assistant
 * refines it with the goal and requirements; this is what is offered without one.
 */
export function recommendStack(platforms: Platform[], kind: ProjectKind = "fullstack"): StackRecommendation {
  const info = PROJECT_KIND_INFO[kind];
  const chosen = info.platforms ?? platforms;
  const web = chosen.includes("web");
  const desktop = chosen.includes("desktop");
  const mobile = chosen.includes("mobile");
  if (info.ui && !web && !desktop && !mobile) return { stack: [], databases: [], rationale: "Elige al menos una plataforma.", alternatives: [] };

  const result = (stack: string[], databases: string[], reasons: string[], alternatives: StackRecommendation["alternatives"]) => ({
    stack: buildStack(stack),
    databases,
    rationale: `${reasons.filter(Boolean).join(", ").replace(/^./, (c) => c.toUpperCase())}.`,
    alternatives: alternatives.map((a) => ({ ...a, stack: buildStack(a.stack) })),
  });
  const swapIn = (stack: string[]) => (remove: string[], add: string[]) => unique([...stack.filter((s) => !remove.includes(s)), ...add]);

  if (kind === "cli" || kind === "library") {
    const stack = ["TypeScript", "Bun", "Bun test"];
    const swap = swapIn(stack);
    const what = kind === "cli" ? "un binario" : "un paquete";
    return result(stack, [], [`TypeScript sobre Bun, que compila ${what} y trae su propio runner de tests`], [
      ...(kind === "cli" ? [{ stack: ["Go"], databases: [], when: "Quieres un único ejecutable sin runtime" }] : []),
      { stack: ["Rust"], databases: [], when: kind === "cli" ? "Necesitas el máximo rendimiento" : "Es una librería nativa o para WebAssembly" },
      { stack: swap(["TypeScript", "Bun", "Bun test"], ["Python", "Pytest"]), databases: [], when: "El equipo trabaja en Python" },
    ]);
  }

  if (kind === "api") {
    const stack = ["TypeScript", "Bun", "Hono", "Drizzle ORM", "Bun test"];
    const swap = swapIn(stack);
    return result(stack, ["PostgreSQL"], ["una API en Hono sobre Bun", "PostgreSQL con Drizzle para los datos"], [
      { stack: ["Python", "FastAPI", "SQLAlchemy", "Pytest"], databases: ["PostgreSQL"], when: "El equipo trabaja en Python" },
      { stack: ["Go", "Gin"], databases: ["PostgreSQL"], when: "Buscas un servicio compilado y muy liviano" },
      { stack: swap(["Hono"], ["NestJS"]), databases: ["PostgreSQL"], when: "Prefieres una estructura con módulos e inyección de dependencias" },
    ]);
  }

  const server = info.server;
  const ui = web || desktop ? ["React", "Tailwind CSS"] : [];
  const stack = unique([
    "TypeScript",
    ...ui,
    ...(desktop ? ["Tauri", "Rust"] : []),
    ...(mobile ? ["React Native", "Expo"] : []),
    ...(server ? ["Bun", "Hono", "Drizzle ORM"] : ["Bun"]),
    "Vitest",
    ...(web || desktop ? ["Playwright"] : []),
    ...(mobile ? ["Detox"] : []),
  ]);
  const local = desktop || mobile;
  const databases = unique([...(server ? ["PostgreSQL"] : []), ...(local ? ["SQLite"] : [])]);
  const swap = swapIn(stack);
  const alternatives: StackRecommendation["alternatives"] = [];
  if (web) alternatives.push({ stack: swap(["React"], ["Next.js"]), databases, when: "Necesitas renderizado en servidor y SEO" });
  if (desktop) alternatives.push({ stack: swap(["Tauri", "Rust"], ["Electron"]), databases, when: "Prefieres todo en Node sin Rust" });
  if (mobile) {
    alternatives.push({
      stack: swap(["React Native", "Expo", "Detox"], ["Flutter", "Dart", "Maestro"]),
      databases,
      when: "Quieres una UI móvil muy personalizada",
    });
  }
  if (server) {
    alternatives.push({
      stack: swap(["Bun", "Hono", "Drizzle ORM"], ["FastAPI", "Python", "SQLAlchemy", "Pytest"]),
      databases,
      when: "El equipo trabaja en Python en el backend",
    });
  }
  return result(stack, databases, [
    ui.length ? "React en la interfaz" : "",
    desktop ? "Tauri empaqueta esa misma UI para escritorio" : "",
    mobile ? "React Native comparte tipos y lógica en iOS y Android" : "",
    server ? "un backend ligero en Bun con PostgreSQL" : "Bun para instalar, compilar y probar",
    local ? "SQLite para datos locales" : "",
  ], alternatives);
}

/** Shown as checkboxes in the wizard. */
export const DATABASE_OPTIONS: DatabaseOption[] = [
  { name: "PostgreSQL", kind: "relational", platforms: ["web", "mobile", "desktop"], aliases: ["postgres", "pg"] },
  { name: "MySQL", kind: "relational", platforms: ["web", "mobile"] },
  { name: "SQL Server", kind: "relational", platforms: ["web", "desktop"], aliases: ["mssql"] },
  { name: "SQLite", kind: "embedded", platforms: ["desktop", "mobile", "web"] },
  { name: "MongoDB", kind: "document", platforms: ["web", "mobile"], aliases: ["mongo"] },
  { name: "Firebase Firestore", kind: "document", platforms: ["mobile", "web"], aliases: ["firebase"] },
  { name: "Supabase", kind: "relational", platforms: ["web", "mobile"] },
  { name: "Redis", kind: "key-value", platforms: ["web", "mobile"] },
  { name: "Elasticsearch", kind: "search", platforms: ["web"], aliases: ["elastic"] },
];

/** Offered by autocomplete under "Otras bases de datos". Ordered by how often they come up. */
export const DATABASE_SUGGESTIONS: DatabaseOption[] = [
  { name: "MariaDB", kind: "relational", platforms: ["web", "mobile"] },
  { name: "Neon", kind: "relational", platforms: ["web", "mobile"], aliases: ["postgres serverless"] },
  { name: "Turso", kind: "embedded", platforms: ["web", "mobile", "desktop"], aliases: ["libsql", "sqlite edge"] },
  { name: "DuckDB", kind: "embedded", platforms: ["desktop", "web"] },
  { name: "Realm", kind: "embedded", platforms: ["mobile"], aliases: ["atlas device sdk"] },
  { name: "WatermelonDB", kind: "embedded", platforms: ["mobile"] },
  { name: "IndexedDB", kind: "embedded", platforms: ["web"] },
  { name: "Oracle Database", kind: "relational", platforms: ["web", "desktop"], aliases: ["oracle"] },
  { name: "CockroachDB", kind: "relational", platforms: ["web"], aliases: ["cockroach"] },
  { name: "PlanetScale", kind: "relational", platforms: ["web"] },
  { name: "Amazon DynamoDB", kind: "key-value", platforms: ["web", "mobile"], aliases: ["dynamo", "aws"] },
  { name: "Amazon Aurora", kind: "relational", platforms: ["web"], aliases: ["aws"] },
  { name: "Azure Cosmos DB", kind: "document", platforms: ["web", "mobile"], aliases: ["cosmos"] },
  { name: "Google Cloud Spanner", kind: "relational", platforms: ["web"], aliases: ["spanner"] },
  { name: "Firebase Realtime Database", kind: "document", platforms: ["mobile", "web"], aliases: ["firebase"] },
  { name: "CouchDB", kind: "document", platforms: ["web", "mobile"], aliases: ["couch"] },
  { name: "PouchDB", kind: "document", platforms: ["web", "mobile"] },
  { name: "Couchbase", kind: "document", platforms: ["web", "mobile"] },
  { name: "RavenDB", kind: "document", platforms: ["web"] },
  { name: "Valkey", kind: "key-value", platforms: ["web"], aliases: ["redis"] },
  { name: "Memcached", kind: "key-value", platforms: ["web"] },
  { name: "Cassandra", kind: "wide-column", platforms: ["web"], aliases: ["apache cassandra"] },
  { name: "ScyllaDB", kind: "wide-column", platforms: ["web"], aliases: ["scylla"] },
  { name: "ClickHouse", kind: "time-series", platforms: ["web"] },
  { name: "TimescaleDB", kind: "time-series", platforms: ["web"], aliases: ["timescale"] },
  { name: "InfluxDB", kind: "time-series", platforms: ["web"], aliases: ["influx"] },
  { name: "Neo4j", kind: "graph", platforms: ["web"] },
  { name: "ArangoDB", kind: "graph", platforms: ["web"] },
  { name: "Meilisearch", kind: "search", platforms: ["web", "mobile"] },
  { name: "Typesense", kind: "search", platforms: ["web", "mobile"] },
  { name: "OpenSearch", kind: "search", platforms: ["web"] },
  { name: "Algolia", kind: "search", platforms: ["web", "mobile"] },
  { name: "pgvector", kind: "vector", platforms: ["web"], aliases: ["postgres vector"] },
  { name: "Qdrant", kind: "vector", platforms: ["web"] },
  { name: "Pinecone", kind: "vector", platforms: ["web"] },
  { name: "Weaviate", kind: "vector", platforms: ["web"] },
  { name: "Chroma", kind: "vector", platforms: ["web", "desktop"] },
];

export const DATABASE_KIND_LABEL: Record<DatabaseKind, string> = {
  relational: "Relacional",
  document: "Documentos",
  "key-value": "Clave valor",
  embedded: "Embebida",
  search: "Búsqueda",
  graph: "Grafos",
  vector: "Vectorial",
  "time-series": "Series de tiempo",
  "wide-column": "Columnar",
};
