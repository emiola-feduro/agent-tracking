import { newPart, slugify, type ProjectKind, type ProjectPart, type ProjectStructure } from "@agent-tracking/core";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";

/**
 * Finds the pieces of a repository that is already a monorepo, so importing it proposes them in
 * the wizard. It reads the usual workspace declarations (package.json workspaces, pnpm, Melos or a
 * Dart workspace, Gradle, Cargo, go.work, uv) and, without any, the apps/* and packages/* folders
 * that hold a manifest. Each piece gets a kind and a stack guessed from its manifest.
 */
export type DetectedStructure = { structure: ProjectStructure; tool: string | null; parts: ProjectPart[] };

const read = (path: string) => readFile(path, "utf8").catch(() => null);
const exists = (path: string) => stat(path).then(() => true, () => false);
const isDir = (path: string) => stat(path).then((s) => s.isDirectory(), () => false);

/** `apps/*`, `packages/**` or a plain folder, expanded one level (enough for workspace globs in practice). */
async function expand(root: string, patterns: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const raw of patterns) {
    const pattern = raw.trim().replace(/^\.\//, "").replace(/\/+$/, "");
    if (!pattern || pattern.startsWith("!") || pattern.includes("..")) continue;
    const star = pattern.indexOf("*");
    if (star < 0) {
      if (await isDir(join(root, pattern))) out.push(pattern);
      continue;
    }
    const base = pattern.slice(0, star).replace(/\/+$/, "");
    const names = await readdir(join(root, base), { withFileTypes: true }).catch(() => []);
    for (const entry of names) if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") out.push(base ? `${base}/${entry.name}` : entry.name);
  }
  return [...new Set(out)].sort();
}

/** Items of a YAML list under `key:` (simple block lists, as workspace files write them). */
function yamlList(text: string, key: string): string[] {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => new RegExp(`^${key}:\\s*$`).test(l));
  if (start < 0) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const m = /^\s+-\s*["']?([^"'#]+?)["']?\s*(#.*)?$/.exec(line);
    if (m) out.push(m[1]!);
    else if (line.trim() && !/^\s/.test(line)) break;
  }
  return out;
}

const tomlArray = (text: string, key: string) => {
  const m = new RegExp(`${key}\\s*=\\s*\\[([^\\]]*)\\]`, "m").exec(text);
  return m ? [...m[1]!.matchAll(/["']([^"']+)["']/g)].map((x) => x[1]!) : [];
};

/** Workspace folders and the tool that declares them. */
async function declared(root: string): Promise<{ tool: string | null; dirs: string[] } | null> {
  const pkgText = await read(join(root, "package.json"));
  const pkg = pkgText ? (JSON.parse(pkgText) as { workspaces?: string[] | { packages?: string[] } }) : null;
  const jsTool = async (fallback: string) =>
    (await exists(join(root, "turbo.json"))) ? "turborepo" : (await exists(join(root, "nx.json"))) ? "nx" : fallback;
  const pnpm = await read(join(root, "pnpm-workspace.yaml"));
  if (pnpm) return { tool: await jsTool("pnpm-workspaces"), dirs: await expand(root, yamlList(pnpm, "packages")) };
  const workspaces = Array.isArray(pkg?.workspaces) ? pkg.workspaces : pkg?.workspaces?.packages;
  if (workspaces?.length) {
    const bun = (await exists(join(root, "bun.lock"))) || (await exists(join(root, "bun.lockb")));
    return { tool: await jsTool(bun ? "bun-workspaces" : "npm-workspaces"), dirs: await expand(root, workspaces) };
  }
  const melos = await read(join(root, "melos.yaml"));
  const pubspec = await read(join(root, "pubspec.yaml"));
  const dartWorkspace = pubspec ? yamlList(pubspec, "workspace") : [];
  if (melos || dartWorkspace.length) return { tool: "melos", dirs: await expand(root, dartWorkspace.length ? dartWorkspace : yamlList(melos!, "packages")) };
  const gradle = (await read(join(root, "settings.gradle.kts"))) ?? (await read(join(root, "settings.gradle")));
  if (gradle) {
    const modules = [...gradle.matchAll(/include\s*\(?([^)\n]+)\)?/g)].flatMap((m) => [...m[1]!.matchAll(/["']:?([^"']+)["']/g)].map((x) => x[1]!.replaceAll(":", "/")));
    if (modules.length) return { tool: "gradle", dirs: await expand(root, modules) };
  }
  const cargo = await read(join(root, "Cargo.toml"));
  if (cargo && /^\[workspace\]/m.test(cargo)) return { tool: "cargo", dirs: await expand(root, tomlArray(cargo, "members")) };
  const goWork = await read(join(root, "go.work"));
  if (goWork) {
    const block = /use\s*\(([^)]*)\)/m.exec(goWork)?.[1] ?? "";
    const single = [...goWork.matchAll(/^use\s+(\S+)\s*$/gm)].map((m) => m[1]!);
    return { tool: "go-work", dirs: await expand(root, [...block.split("\n").map((l) => l.trim()).filter(Boolean), ...single]) };
  }
  const pyproject = await read(join(root, "pyproject.toml"));
  if (pyproject && /\[tool\.uv\.workspace\]/.test(pyproject)) return { tool: "uv", dirs: await expand(root, tomlArray(pyproject, "members")) };
  return null;
}

const MANIFESTS = ["package.json", "pubspec.yaml", "Cargo.toml", "go.mod", "pyproject.toml", "build.gradle.kts", "build.gradle", "requirements.txt"];

const has = (deps: Record<string, unknown>, ...names: string[]) => names.some((n) => n in deps);

/** Kind, platforms and stack of one folder, from its manifest. */
async function describe(root: string, dir: string): Promise<Pick<ProjectPart, "kind" | "platforms" | "stack"> | null> {
  const at = (file: string) => join(root, dir, file);
  const pkgText = await read(at("package.json"));
  if (pkgText) {
    const pkg = JSON.parse(pkgText) as { dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown>; bin?: unknown };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const ts = has(deps, "typescript") || (await exists(at("tsconfig.json")));
    const stack = [ts ? "TypeScript" : "JavaScript"];
    const web = (name: string) => ({ kind: "frontend" as ProjectKind, platforms: ["web" as const], stack: [...stack, name] });
    if (has(deps, "expo")) return { kind: "mobile", platforms: ["mobile"], stack: [...stack, "React Native", "Expo"] };
    if (has(deps, "react-native")) return { kind: "mobile", platforms: ["mobile"], stack: [...stack, "React Native"] };
    if (has(deps, "electron")) return { kind: "desktop", platforms: ["desktop"], stack: [...stack, "Electron"] };
    if (has(deps, "@tauri-apps/api", "@tauri-apps/cli")) return { kind: "desktop", platforms: ["desktop"], stack: [...stack, "Tauri", "Rust"] };
    if (has(deps, "next")) return web("Next.js");
    if (has(deps, "nuxt")) return web("Nuxt");
    if (has(deps, "@sveltejs/kit")) return web("SvelteKit");
    if (has(deps, "astro")) return web("Astro");
    if (has(deps, "@angular/core")) return web("Angular");
    if (has(deps, "vue")) return web("Vue");
    if (has(deps, "svelte")) return web("Svelte");
    if (has(deps, "solid-js")) return web("SolidJS");
    if (has(deps, "react")) return web("React");
    for (const [dep, name] of [["@nestjs/core", "NestJS"], ["hono", "Hono"], ["express", "Express"], ["fastify", "Fastify"], ["elysia", "Elysia"]] as const) {
      if (dep in deps) return { kind: "api", platforms: [], stack: [...stack, name] };
    }
    return { kind: pkg.bin ? "cli" : "library", platforms: [], stack };
  }
  const pubspec = await read(at("pubspec.yaml"));
  if (pubspec) {
    if (!/sdk:\s*flutter/.test(pubspec)) return { kind: "library", platforms: [], stack: ["Dart"] };
    const platforms = [
      ...((await isDir(at("web"))) ? (["web"] as const) : []),
      ...((await isDir(at("linux"))) || (await isDir(at("macos"))) || (await isDir(at("windows"))) ? (["desktop"] as const) : []),
      ...((await isDir(at("android"))) || (await isDir(at("ios"))) ? (["mobile"] as const) : []),
    ];
    const isApp = (await exists(at("lib/main.dart"))) || platforms.length > 0;
    if (!isApp) return { kind: "library", platforms: [], stack: ["Dart", "Flutter"] };
    return platforms.length === 1 && platforms[0] === "mobile"
      ? { kind: "mobile", platforms: ["mobile"], stack: ["Dart", "Flutter"] }
      : { kind: "app", platforms: platforms.length ? [...platforms] : ["mobile"], stack: ["Dart", "Flutter"] };
  }
  const cargo = await read(at("Cargo.toml"));
  if (cargo) {
    if (/tauri/.test(cargo)) return { kind: "desktop", platforms: ["desktop"], stack: ["Rust", "Tauri"] };
    return { kind: (await exists(at("src/main.rs"))) || /\[\[bin\]\]/.test(cargo) ? "cli" : "library", platforms: [], stack: ["Rust"] };
  }
  const gomod = await read(at("go.mod"));
  if (gomod) {
    if (/gin-gonic\/gin/.test(gomod)) return { kind: "api", platforms: [], stack: ["Go", "Gin"] };
    return { kind: (await exists(at("main.go"))) ? "cli" : "library", platforms: [], stack: ["Go"] };
  }
  const python = `${(await read(at("pyproject.toml"))) ?? ""}\n${(await read(at("requirements.txt"))) ?? ""}`;
  if (python.trim()) {
    for (const [dep, name] of [["fastapi", "FastAPI"], ["django", "Django"], ["flask", "Flask"]] as const) {
      if (new RegExp(`\\b${dep}\\b`, "i").test(python)) return { kind: "api", platforms: [], stack: ["Python", name] };
    }
    return { kind: "library", platforms: [], stack: ["Python"] };
  }
  const gradle = (await read(at("build.gradle.kts"))) ?? (await read(at("build.gradle")));
  if (gradle) {
    const language = /kotlin/.test(gradle) ? "Kotlin" : "Java";
    if (/com\.android\.application/.test(gradle)) return { kind: "mobile", platforms: ["mobile"], stack: ["Kotlin", ...(/compose/i.test(gradle) ? ["Jetpack Compose"] : [])] };
    if (/springframework\.boot/.test(gradle)) return { kind: "api", platforms: [], stack: [language, "Spring Boot"] };
    return { kind: "library", platforms: [], stack: [language] };
  }
  return null;
}

export async function detectStructure(root: string): Promise<DetectedStructure | null> {
  let found = await declared(root).catch(() => null);
  if (!found || found.dirs.length === 0) {
    // No declaration: apps/* and packages/* folders that have a manifest of their own.
    const dirs: string[] = [];
    for (const dir of await expand(root, ["apps/*", "packages/*", "services/*"])) {
      for (const m of MANIFESTS) if (await exists(join(root, dir, m))) {
        dirs.push(dir);
        break;
      }
    }
    if (dirs.length < 2) return null;
    found = { tool: "folders", dirs };
  }
  const parts: ProjectPart[] = [];
  for (const dir of found.dirs) {
    const info = await describe(root, dir).catch(() => null);
    if (!info) continue;
    const name = slugify(basename(dir));
    parts.push({ ...newPart(info.kind, parts), name, path: dir, ...info, stack: [...new Set(info.stack)] });
  }
  return parts.length ? { structure: "monorepo", tool: found.tool, parts } : null;
}
