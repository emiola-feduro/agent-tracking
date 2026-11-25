import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, sep } from "node:path";
import type { SkillSource } from "@agent-tracking/core";

export interface DiscoveredSkill {
  name: string;
  description: string;
  source: Exclude<SkillSource, "created">;
  /** Ruta absoluta al SKILL.md */
  location: string;
  /** Plugin al que pertenece, si aplica */
  plugin?: string;
}

export interface DiscoverOptions {
  /** Directorio del usuario (por defecto ~/.claude) */
  claudeHome?: string;
  /** Raíz del repositorio del proyecto, para `.claude/skills` */
  repoPath?: string | null;
  /** Profundidad máxima al buscar SKILL.md dentro de plugins */
  maxPluginDepth?: number;
}

/** Parsea el frontmatter YAML de un SKILL.md. Devuelve null si no tiene `name`. */
export function parseSkillFrontmatter(content: string): { name: string; description: string } | null {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  let data: unknown;
  try {
    data = Bun.YAML.parse(m[1]!);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const { name, description } = data as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim()) return null;
  return { name: name.trim(), description: typeof description === "string" ? description.trim() : "" };
}

async function isDir(p: string) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/** Skills con layout `<dir>/<skill>/SKILL.md` */
async function scanSkillsDir(dir: string): Promise<string[]> {
  if (!(await isDir(dir))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    if (!e.isDirectory() && !e.isSymbolicLink()) continue;
    const file = join(dir, e.name, "SKILL.md");
    if (await Bun.file(file).exists()) out.push(file);
  }
  return out;
}

/** Busca `skills/<skill>/SKILL.md` en cualquier nivel bajo un directorio de plugins. */
async function scanPluginsDir(root: string, maxDepth: number, skip: string[] = []): Promise<string[]> {
  if (!(await isDir(root))) return [];
  const out: string[] = [];
  const walk = async (dir: string, depth: number) => {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name === "node_modules" || e.name.startsWith(".git")) continue;
      const child = join(dir, e.name);
      if (skip.includes(child)) continue;
      if (e.name === "skills") out.push(...(await scanSkillsDir(child)));
      else await walk(child, depth + 1);
    }
  };
  await walk(root, 0);
  return out;
}

/** Nombre del plugin: `.claude-plugin/plugin.json` del directorio padre de `skills/`, o ese directorio. */
async function pluginNameFor(file: string): Promise<string | undefined> {
  const parts = file.split(sep);
  const idx = parts.lastIndexOf("skills");
  if (idx <= 0) return undefined;
  const pluginDir = parts.slice(0, idx).join(sep);
  try {
    const manifest = JSON.parse(await readFile(join(pluginDir, ".claude-plugin", "plugin.json"), "utf8"));
    if (typeof manifest.name === "string") return manifest.name;
  } catch {}
  return parts[idx - 1];
}

async function collect(
  groups: Array<{ source: DiscoveredSkill["source"]; files: string[]; isPlugin?: boolean }>,
): Promise<DiscoveredSkill[]> {
  const seen = new Set<string>();
  const result: DiscoveredSkill[] = [];
  for (const g of groups) {
    for (const file of g.files) {
      const real = await realpath(file).catch(() => file);
      if (seen.has(real)) continue;
      seen.add(real);
      const meta = parseSkillFrontmatter(await readFile(file, "utf8").catch(() => ""));
      if (!meta) continue;
      const plugin = g.isPlugin ? await pluginNameFor(file) : undefined;
      // El mismo plugin puede estar cacheado en varias versiones: una entrada por plugin+skill.
      const key = `${g.source}:${plugin ?? ""}:${meta.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ ...meta, source: g.source, location: file, ...(plugin ? { plugin } : {}) });
    }
  }
  return result;
}

/** Descubre las skills que la persona ya tiene instaladas (repo, usuario y plugins). */
export async function discoverSkills(opts: DiscoverOptions = {}): Promise<DiscoveredSkill[]> {
  const claudeHome = opts.claudeHome ?? join(homedir(), ".claude");
  const maxDepth = opts.maxPluginDepth ?? 6;
  const plugins = join(claudeHome, "plugins");
  return collect([
    { source: "repo", files: opts.repoPath ? await scanSkillsDir(join(opts.repoPath, ".claude", "skills")) : [] },
    { source: "user", files: await scanSkillsDir(join(claudeHome, "skills")) },
    { source: "plugin", files: await scanPluginsDir(plugins, maxDepth, [join(plugins, "marketplaces")]), isPlugin: true },
    { source: "plugin", files: await scanPluginsDir(join(claudeHome, "remote", "plugins"), maxDepth), isPlugin: true },
  ]);
}

/** Skills disponibles en los marketplaces conocidos pero no necesariamente instaladas (para sugerir). */
export async function discoverCatalogSkills(opts: DiscoverOptions = {}): Promise<DiscoveredSkill[]> {
  const claudeHome = opts.claudeHome ?? join(homedir(), ".claude");
  const files = await scanPluginsDir(join(claudeHome, "plugins", "marketplaces"), opts.maxPluginDepth ?? 6);
  return collect([{ source: "catalog", files, isPlugin: true }]);
}

/** Plantilla para crear una skill nueva cuando la persona no tiene ninguna adecuada. */
export function skillTemplate(name: string, description: string, body = ""): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return [
    "---",
    `name: ${slug}`,
    `description: ${JSON.stringify(description.trim())}`,
    "---",
    "",
    `# ${name.trim()}`,
    "",
    body.trim() || "Describe aquí cuándo usar esta skill y los pasos o convenciones que el agente debe seguir.",
    "",
  ].join("\n");
}
export * from "./portable";
