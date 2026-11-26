import { PROJECT_KIND_INFO, type ProjectKind } from "./project-kind";
import { STACK_LANGUAGES, STACK_OPTIONS, stackLanguages } from "./stack";
import type { Platform } from "./types";

/**
 * How a repository is organised. A single app is one piece at the root; a monorepo holds several
 * pieces (a mobile app, an API, a web panel, a shared library), each in its own folder with its own
 * kind, platforms and stack. The pieces travel in .agent-tracking and CONTEXT.md, so every agent
 * knows where each thing goes, and requirements can point at the pieces they touch.
 */
export const PROJECT_STRUCTURES = ["single", "monorepo"] as const;
export type ProjectStructure = (typeof PROJECT_STRUCTURES)[number];

export type ProjectPart = {
  id: string;
  name: string;
  kind: ProjectKind;
  /** Only chosen for kinds without fixed platforms (see PROJECT_KIND_INFO). */
  platforms: Platform[];
  /** Folder relative to the repository root, e.g. apps/mobile. */
  path: string;
  stack: string[];
};

export type MonorepoTool = {
  id: string;
  label: string;
  description: string;
  /** Languages it is made for; null when it fits any. */
  languages: string[] | null;
};

const JS = ["TypeScript", "JavaScript"];

export const MONOREPO_TOOLS: MonorepoTool[] = [
  { id: "bun-workspaces", label: "Workspaces de Bun", description: "Un solo bun install para todas las piezas de JavaScript o TypeScript", languages: JS },
  { id: "pnpm-workspaces", label: "Workspaces de pnpm", description: "Instalaciones rápidas y dependencias estrictas entre paquetes", languages: JS },
  { id: "npm-workspaces", label: "Workspaces de npm", description: "Sin herramientas extra, con el npm de Node.js", languages: JS },
  { id: "turborepo", label: "Turborepo", description: "Workspaces con caché y orden de tareas (build, test) entre piezas", languages: JS },
  { id: "nx", label: "Nx", description: "Grafo de proyectos, caché y generadores para monorepos grandes", languages: JS },
  { id: "melos", label: "Melos", description: "Varios paquetes de Dart y Flutter en un repositorio", languages: ["Dart"] },
  { id: "gradle", label: "Gradle multiproyecto", description: "Módulos de Kotlin o Java en un mismo build", languages: ["Kotlin", "Java"] },
  { id: "cargo", label: "Workspace de Cargo", description: "Varios crates de Rust con un solo Cargo.lock", languages: ["Rust"] },
  { id: "go-work", label: "Go workspaces", description: "Varios módulos de Go con go.work", languages: ["Go"] },
  { id: "uv", label: "Workspace de uv", description: "Varios paquetes de Python con un solo entorno", languages: ["Python"] },
  { id: "dotnet", label: "Solución de .NET", description: "Varios proyectos de C# en una solución (.sln)", languages: ["C#"] },
  { id: "folders", label: "Solo carpetas", description: "Sin herramienta: cada pieza se instala y se construye por su cuenta", languages: null },
];

export const monorepoToolLabel = (id: string | null | undefined) => MONOREPO_TOOLS.find((t) => t.id === id)?.label ?? null;

/** Languages a stack is written in: the ones chosen, or the ones its frameworks use. */
export function stackLanguagesOf(stack: string[]): string[] {
  const chosen = STACK_LANGUAGES.filter((l) => stack.includes(l));
  if (chosen.length) return chosen;
  const out = new Set<string>();
  for (const name of stack) for (const l of stackLanguages(name) ?? []) out.add(l);
  return [...out];
}

const FRAMEWORK_CATEGORIES = new Set(["crossplatform", "mobile", "frontend", "desktop", "backend"]);

/** The frameworks of a stack (Flutter, React, Hono), what a piece is mostly made of. */
export const stackFrameworks = (stack: string[]) =>
  stack.filter((name) => FRAMEWORK_CATEGORIES.has(STACK_OPTIONS.find((o) => o.name === name)?.category ?? ""));

/**
 * The language a piece is written in: the one of its main framework (Flutter makes it Dart even if
 * TypeScript is also chosen), else the first language chosen.
 */
export function mainLanguage(stack: string[]): string | null {
  for (const framework of stackFrameworks(stack)) {
    const langs = stackLanguages(framework);
    if (langs?.length) return langs.find((l) => stack.includes(l)) ?? langs[0]!;
  }
  return stackLanguagesOf(stack)[0] ?? null;
}

/** Tools that fit the languages of the pieces, best first. "Solo carpetas" always fits. */
export function monorepoToolsFor(parts: Pick<ProjectPart, "stack">[]): MonorepoTool[] {
  const languages = new Set(parts.flatMap((p) => stackLanguagesOf(p.stack)));
  return MONOREPO_TOOLS.filter((t) => !t.languages || t.languages.some((l) => languages.has(l)));
}

/** A sensible default: the JavaScript workspace of the runtime in use, else the tool of the main language. */
export function recommendMonorepoTool(parts: Pick<ProjectPart, "stack">[]): string {
  const stacks = parts.map((p) => p.stack);
  const languages = new Set(stacks.flatMap(stackLanguagesOf));
  const all = stacks.flat();
  if ([...languages].some((l) => JS.includes(l))) return all.includes("Bun") ? "bun-workspaces" : "pnpm-workspaces";
  const byLanguage: [string, string][] = [
    ["Dart", "melos"],
    ["Kotlin", "gradle"],
    ["Java", "gradle"],
    ["Rust", "cargo"],
    ["Go", "go-work"],
    ["Python", "uv"],
    ["C#", "dotnet"],
  ];
  return byLanguage.find(([l]) => languages.has(l))?.[1] ?? "folders";
}

const DEFAULT_NAME: Record<ProjectKind, string> = {
  fullstack: "app",
  app: "app",
  frontend: "web",
  api: "api",
  desktop: "desktop",
  mobile: "mobile",
  cli: "cli",
  library: "shared",
};

export const slugify = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "pieza";

/** Where a new piece goes: apps/<name> for apps, packages/<name> for libraries, never a folder already used. */
export function suggestPartPath(kind: ProjectKind, name: string, taken: string[] = []): string {
  const base = `${kind === "library" ? "packages" : "apps"}/${slugify(name || DEFAULT_NAME[kind])}`;
  let path = base;
  for (let i = 2; taken.includes(path); i++) path = `${base}-${i}`;
  return path;
}

/** A new piece of the given kind with its default name and folder. */
export function newPart(kind: ProjectKind, taken: Pick<ProjectPart, "name" | "path">[] = [], id: string = crypto.randomUUID()): ProjectPart {
  const names = taken.map((p) => p.name);
  let name = DEFAULT_NAME[kind];
  for (let i = 2; names.includes(name); i++) name = `${DEFAULT_NAME[kind]}-${i}`;
  return { id, name, kind, platforms: PROJECT_KIND_INFO[kind].platforms ?? [], path: suggestPartPath(kind, name, taken.map((p) => p.path)), stack: [] };
}

/** Platforms of a piece: the fixed ones of its kind, or the ones chosen. */
export const partPlatforms = (p: Pick<ProjectPart, "kind" | "platforms">): Platform[] => PROJECT_KIND_INFO[p.kind].platforms ?? p.platforms;

/** Folder rules: relative, inside the repo, plain names (letters, digits, - _ . and /). */
export function partPathProblem(path: string): string | null {
  const p = path.trim();
  if (!p) return "Falta la carpeta";
  if (p.startsWith("/") || /^[a-zA-Z]:/.test(p)) return "La carpeta debe ser relativa a la raíz del repositorio";
  if (p.split("/").some((seg) => seg === ".." || seg === "." || seg === "")) return "La carpeta no puede tener segmentos vacíos, . ni ..";
  if (!/^[A-Za-z0-9._\-/]+$/.test(p)) return "Usa solo letras, números, guiones, puntos y /";
  if (p === ".agent-tracking" || p.startsWith(".agent-tracking/") || p === ".git" || p.startsWith(".git/")) return "Esa carpeta la usa Agent Tracking o git";
  return null;
}

/** Problems that keep the pieces from being saved, in Spanish, one per line. */
export function partsProblems(parts: ProjectPart[]): string[] {
  const out: string[] = [];
  if (parts.length === 0) out.push("Agrega al menos una pieza");
  const names = new Set<string>();
  const paths: string[] = [];
  for (const part of parts) {
    const label = part.name.trim() || "Una pieza";
    if (!part.name.trim()) out.push("Cada pieza necesita un nombre");
    else if (names.has(part.name.trim().toLowerCase())) out.push(`Hay dos piezas llamadas ${part.name.trim()}`);
    names.add(part.name.trim().toLowerCase());
    const problem = partPathProblem(part.path);
    if (problem) out.push(`${label}: ${problem.charAt(0).toLowerCase()}${problem.slice(1)}`);
    const path = part.path.trim().replace(/\/+$/, "");
    if (!problem && paths.some((other) => other === path || other.startsWith(`${path}/`) || path.startsWith(`${other}/`))) {
      out.push(`${label}: su carpeta se cruza con la de otra pieza`);
    }
    paths.push(path);
    if (PROJECT_KIND_INFO[part.kind].platforms === null && part.platforms.length === 0) out.push(`${label}: elige al menos una plataforma`);
  }
  return [...new Set(out)];
}

/**
 * What the project as a whole is, from its pieces: the union of platforms and stacks, and a kind
 * (an app with a backend is a full app; several interfaces without a backend, a multiplatform app).
 */
export function summarizeParts(parts: ProjectPart[]): { kind: ProjectKind; platforms: Platform[]; stack: string[] } {
  const platforms = [...new Set(parts.flatMap(partPlatforms))];
  const stack = [...new Set(parts.flatMap((p) => p.stack))];
  const ui = parts.filter((p) => PROJECT_KIND_INFO[p.kind].ui);
  const server = parts.some((p) => PROJECT_KIND_INFO[p.kind].server);
  let kind: ProjectKind;
  if (ui.length && server) kind = "fullstack";
  else if (ui.length) kind = ui.length === 1 ? ui[0]!.kind : "app";
  else if (server) kind = "api";
  else kind = parts[0]?.kind ?? "library";
  return { kind, platforms, stack };
}

/* ---------- Scaffolding ---------- */

export type ScaffoldInput = {
  name: string;
  structure: ProjectStructure;
  parts: ProjectPart[];
  tool: string | null;
};

export type ScaffoldFile = { path: string; content: string; note?: string };

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
const snake = (text: string) => slugify(text).replace(/-/g, "_");
const join = (dir: string, file: string) => (dir && dir !== "." ? `${dir}/${file}` : file);
const isJs = (stack: string[]) => JS.includes(mainLanguage(stack) ?? "");

/** The manifest a piece starts with, from its main language; none when the language has no simple one. */
function partManifest(input: ScaffoldInput, part: ProjectPart): ScaffoldFile | null {
  const main = mainLanguage(part.stack);
  const languages = main ? [main] : [];
  const dir = input.structure === "single" ? "" : part.path.trim();
  const root = slugify(input.name);
  const name = input.structure === "single" ? root : `${root}-${slugify(part.name)}`;
  if (main && JS.includes(main)) {
    const pkg = { name: input.structure === "single" ? root : `@${root}/${slugify(part.name)}`, version: "0.1.0", private: true, type: "module" };
    return { path: join(dir, "package.json"), content: json(pkg) };
  }
  if (languages.includes("Dart")) {
    const flutter = part.stack.includes("Flutter");
    const lines = [
      `name: ${snake(name)}`,
      `description: ${part.name}`,
      "publish_to: none",
      "version: 0.1.0",
      "",
      "environment:",
      '  sdk: ">=3.4.0 <4.0.0"',
      ...(flutter ? ["", "dependencies:", "  flutter:", "    sdk: flutter"] : []),
      ...(input.tool === "melos" && input.structure === "monorepo" ? ["", "resolution: workspace"] : []),
      "",
    ];
    return { path: join(dir, "pubspec.yaml"), content: lines.join("\n") };
  }
  if (languages.includes("Python")) {
    return { path: join(dir, "pyproject.toml"), content: `[project]\nname = "${name}"\nversion = "0.1.0"\nrequires-python = ">=3.11"\ndependencies = []\n` };
  }
  if (languages.includes("Go")) return { path: join(dir, "go.mod"), content: `module ${name}\n\ngo 1.22\n` };
  if (languages.includes("Rust")) {
    return { path: join(dir, "Cargo.toml"), content: `[package]\nname = "${snake(name)}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n` };
  }
  if (languages.includes("Kotlin") || languages.includes("Java")) {
    const plugin = languages.includes("Kotlin") ? '    kotlin("jvm") version "2.1.0"\n' : "    java\n";
    return { path: join(dir, "build.gradle.kts"), content: `plugins {\n${plugin}}\n` };
  }
  return null;
}

function partReadme(input: ScaffoldInput, part: ProjectPart): ScaffoldFile {
  const info = PROJECT_KIND_INFO[part.kind];
  const platforms = partPlatforms(part);
  const lines = [
    `# ${input.structure === "single" ? input.name : part.name}`,
    "",
    `${info.label}${platforms.length ? ` (${platforms.map((p) => PLATFORM_LABEL[p]).join(", ")})` : ""}.`,
    ...(part.stack.length ? ["", `Stack: ${part.stack.join(", ")}.`] : []),
    "",
  ];
  return { path: join(input.structure === "single" ? "" : part.path.trim(), "README.md"), content: lines.join("\n") };
}

const PLATFORM_LABEL: Record<Platform, string> = { web: "web", desktop: "escritorio", mobile: "móvil" };

/** Files at the root that tie the pieces together for the chosen tool. */
function toolFiles(input: ScaffoldInput): ScaffoldFile[] {
  const root = slugify(input.name);
  const parts = input.parts;
  const jsPaths = parts.filter((p) => isJs(p.stack)).map((p) => p.path.trim());
  const workspaces = (list: string[]) => ({ name: root, private: true, workspaces: list });
  switch (input.tool) {
    case "bun-workspaces":
    case "npm-workspaces":
      return [{ path: "package.json", content: json(workspaces(jsPaths)), note: "workspaces" }];
    case "pnpm-workspaces":
      return [
        { path: "package.json", content: json({ name: root, private: true }) },
        { path: "pnpm-workspace.yaml", content: `packages:\n${jsPaths.map((p) => `  - "${p}"`).join("\n")}\n`, note: "workspaces" },
      ];
    case "turborepo":
      return [
        { path: "package.json", content: json({ ...workspaces(jsPaths), scripts: { build: "turbo run build", test: "turbo run test", dev: "turbo run dev" } }), note: "workspaces" },
        {
          path: "turbo.json",
          content: json({ $schema: "https://turborepo.com/schema.json", tasks: { build: { dependsOn: ["^build"], outputs: ["dist/**"] }, test: { dependsOn: ["^build"] }, dev: { cache: false, persistent: true } } }),
          note: "tareas de Turborepo",
        },
      ];
    case "nx":
      return [
        { path: "package.json", content: json(workspaces(jsPaths)), note: "workspaces" },
        { path: "nx.json", content: json({ $schema: "./node_modules/nx/schemas/nx-schema.json", targetDefaults: { build: { dependsOn: ["^build"], cache: true }, test: { cache: true } } }), note: "configuración de Nx" },
      ];
    case "melos": {
      const dart = parts.filter((p) => stackLanguagesOf(p.stack).includes("Dart")).map((p) => p.path.trim());
      return [
        {
          path: "pubspec.yaml",
          content: [`name: ${snake(root)}_workspace`, "publish_to: none", "", "environment:", '  sdk: ">=3.4.0 <4.0.0"', "", "workspace:", ...dart.map((p) => `  - ${p}`), "", "dev_dependencies:", "  melos: ^7.0.0", "", "melos:", `  name: ${snake(root)}`, ""].join("\n"),
          note: "workspace de Dart y Melos",
        },
      ];
    }
    case "gradle":
      return [
        {
          path: "settings.gradle.kts",
          content: `rootProject.name = "${root}"\n\n${parts
            .filter((p) => ["Kotlin", "Java"].some((l) => stackLanguagesOf(p.stack).includes(l)))
            .map((p) => `include(":${p.path.trim().replaceAll("/", ":")}")`)
            .join("\n")}\n`,
          note: "módulos de Gradle",
        },
      ];
    case "cargo":
      return [{ path: "Cargo.toml", content: `[workspace]\nresolver = "2"\nmembers = [${parts.filter((p) => stackLanguagesOf(p.stack).includes("Rust")).map((p) => `"${p.path.trim()}"`).join(", ")}]\n`, note: "workspace de Cargo" }];
    case "go-work":
      return [{ path: "go.work", content: `go 1.22\n\nuse (\n${parts.filter((p) => stackLanguagesOf(p.stack).includes("Go")).map((p) => `\t./${p.path.trim()}`).join("\n")}\n)\n`, note: "módulos de Go" }];
    case "uv":
      return [
        {
          path: "pyproject.toml",
          content: `[project]\nname = "${root}"\nversion = "0.1.0"\nrequires-python = ">=3.11"\n\n[tool.uv.workspace]\nmembers = [${parts.filter((p) => stackLanguagesOf(p.stack).includes("Python")).map((p) => `"${p.path.trim()}"`).join(", ")}]\n`,
          note: "workspace de uv",
        },
      ];
    default:
      return [];
  }
}

/**
 * The minimal starting point of the repository: a README per piece and at the root, each piece's
 * manifest, and the files of the monorepo tool. Nothing here overwrites an existing file (the caller
 * skips those). A tool's files take the place of a piece's manifest at the same path.
 */
export function scaffoldFiles(input: ScaffoldInput): ScaffoldFile[] {
  const out = new Map<string, ScaffoldFile>();
  const add = (f: ScaffoldFile | null) => f && !out.has(f.path) && out.set(f.path, f);
  if (input.structure === "monorepo") {
    for (const f of toolFiles(input)) add(f);
    const rows = input.parts.map((p) => `| \`${p.path.trim()}\` | ${p.name} | ${PROJECT_KIND_INFO[p.kind].label} | ${p.stack.join(", ") || "Sin definir"} |`);
    const tool = monorepoToolLabel(input.tool);
    add({
      path: "README.md",
      content: [`# ${input.name}`, "", `Monorepo${tool ? ` con ${tool}` : ""}.`, "", "| Carpeta | Pieza | Tipo | Stack |", "|---|---|---|---|", ...rows, ""].join("\n"),
    });
  }
  for (const part of input.parts) {
    add(partReadme(input, part));
    add(partManifest(input, part));
  }
  return [...out.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * The folder tree the scaffolding leaves, drawn as text for the summary, with what each piece is.
 * `.agent-tracking/` is shown too, since Agent Tracking writes it in every case.
 */
export function proposedTree(input: ScaffoldInput): string {
  const files = scaffoldFiles(input);
  type Node = { children: Map<string, Node>; note?: string };
  const root: Node = { children: new Map() };
  const insert = (path: string, note?: string) => {
    let node = root;
    const segments = path.split("/");
    segments.forEach((segment, i) => {
      const key = i < segments.length - 1 ? `${segment}/` : segment;
      if (!node.children.has(key)) node.children.set(key, { children: new Map() });
      node = node.children.get(key)!;
      if (i === segments.length - 1 && note) node.note = note;
    });
  };
  for (const f of files) insert(f.path, f.note);
  if (input.structure === "monorepo") {
    for (const p of input.parts) {
      const node = p.path
        .trim()
        .split("/")
        .reduce<Node | undefined>((n, s) => n?.children.get(`${s}/`), root);
      const made = stackFrameworks(p.stack).length ? stackFrameworks(p.stack) : stackLanguagesOf(p.stack);
      if (node) node.note = `${p.name}: ${PROJECT_KIND_INFO[p.kind].label}${made.length ? ` (${made.join(", ")})` : ""}`;
    }
  }
  root.children.set(".agent-tracking/", { children: new Map(), note: "contexto y datos de Agent Tracking" });
  const lines = [`${slugify(input.name)}/`];
  const walk = (node: Node, prefix: string) => {
    const entries = [...node.children.entries()].sort(([a], [b]) => {
      const dirA = a.endsWith("/") ? 0 : 1;
      const dirB = b.endsWith("/") ? 0 : 1;
      return dirA - dirB || (a < b ? -1 : a > b ? 1 : 0);
    });
    entries.forEach(([name, child], i) => {
      const last = i === entries.length - 1;
      lines.push(`${prefix}${last ? "└── " : "├── "}${name}${child.note ? `  # ${child.note}` : ""}`);
      walk(child, `${prefix}${last ? "    " : "│   "}`);
    });
  };
  walk(root, "");
  return lines.join("\n");
}

/** Markdown for CONTEXT.md: where each piece lives, so agents put code in the right folder. */
export function partsMarkdown(structure: ProjectStructure, parts: ProjectPart[], tool: string | null): string[] {
  if (structure !== "monorepo" || parts.length === 0) return [];
  const label = monorepoToolLabel(tool);
  return [
    "## Estructura del repositorio",
    "",
    `Monorepo${label ? ` con ${label}` : ""}. Cada pieza vive en su carpeta: el código de una pieza va dentro de ella, y lo que comparten va en una librería.`,
    "",
    ...parts.map((p) => {
      const platforms = partPlatforms(p);
      return `- **${p.name}** en \`${p.path}\`: ${PROJECT_KIND_INFO[p.kind].label}${platforms.length ? ` (${platforms.map((x) => PLATFORM_LABEL[x]).join(", ")})` : ""}${p.stack.length ? `. Stack: ${p.stack.join(", ")}` : ""}.`;
    }),
    "",
  ];
}
