import { sharedSkillPath } from "@agent-tracking/core";
import { cp, lstat, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, sep } from "node:path";

/** Where a skill comes from, so another machine can get the same one. */
export type SkillOrigin = { plugin: string | null; marketplace: string | null; marketplaceSource: string | null };

const NONE: SkillOrigin = { plugin: null, marketplace: null, marketplaceSource: null };

type KnownMarketplace = { source?: { source?: string; repo?: string; url?: string; path?: string } };

/** "owner/repo" for GitHub marketplaces, else the URL or path that `claude plugin marketplace add` takes. */
const sourceText = (m: KnownMarketplace | undefined) => m?.source?.repo ?? m?.source?.url ?? m?.source?.path ?? null;

/**
 * Plugin and marketplace of a skill installed by Claude Code, read from its path:
 * plugins/cache/<marketplace>/<plugin>/<version>/... or plugins/marketplaces/<marketplace>/...
 */
export async function skillOrigin(location: string, claudeHome = join(homedir(), ".claude")): Promise<SkillOrigin> {
  const plugins = join(claudeHome, "plugins");
  const rel = relative(plugins, location);
  if (!rel || rel.startsWith("..")) return NONE;
  const [area, marketplace, second] = rel.split(sep);
  if (!marketplace || (area !== "cache" && area !== "marketplaces")) return NONE;
  let plugin: string | null = area === "cache" ? (second ?? null) : null;
  if (area === "marketplaces") {
    // Inside a marketplace checkout the plugin is the folder that holds skills/.
    const parts = rel.split(sep);
    const at = parts.lastIndexOf("skills");
    plugin = at > 2 ? parts[at - 1]! : null;
  }
  const known = (await readFile(join(plugins, "known_marketplaces.json"), "utf8").then(JSON.parse).catch(() => ({}))) as Record<string, KnownMarketplace>;
  return { plugin, marketplace, marketplaceSource: sourceText(known[marketplace]) };
}

const MAX_FILES = 60;
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Copies a skill folder (the one holding SKILL.md) into the repository. Hidden files, node_modules
 * and anything over the limits are left out, so a stray secret or a huge asset does not end up in git.
 */
export async function shareSkill(skillFile: string, repoRoot: string, name: string): Promise<{ files: number }> {
  const from = dirname(skillFile);
  const to = join(repoRoot, sharedSkillPath(name));
  const files: string[] = [];
  let bytes = 0;
  const walk = async (dir: string) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const path = join(dir, e.name);
      if (e.isDirectory()) await walk(path);
      else if (e.isFile()) {
        const size = (await stat(path)).size;
        if (files.length >= MAX_FILES || bytes + size > MAX_BYTES) throw new Error(`La skill ${name} es demasiado grande para incluirla en el repo`);
        files.push(path);
        bytes += size;
      }
    }
  };
  await walk(from);
  await rm(to, { recursive: true, force: true });
  for (const file of files) {
    const target = join(to, relative(from, file));
    await mkdir(dirname(target), { recursive: true });
    await cp(file, target);
  }
  return { files: files.length };
}

/** Removes a shared copy that is no longer wanted. */
export const unshareSkill = (repoRoot: string, name: string) => rm(join(repoRoot, sharedSkillPath(name)), { recursive: true, force: true });

/**
 * Installs a skill shared in the repository into the person's skills (~/.claude/skills/<folder>).
 * An existing skill with that folder name is never replaced.
 */
export async function installSharedSkill(repoRoot: string, name: string, claudeHome = join(homedir(), ".claude")): Promise<string> {
  const from = join(repoRoot, sharedSkillPath(name));
  if (!(await stat(join(from, "SKILL.md")).catch(() => null))) throw new Error(`El repo no incluye la skill ${name}`);
  const to = join(claudeHome, "skills", sharedSkillPath(name).split("/").pop()!);
  if (await lstat(to).catch(() => null)) throw new Error(`Ya existe ${to}; no se reemplaza`);
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
  return join(to, "SKILL.md");
}

/** The commands that install a plugin's skills, in order (the marketplace first when it is not known). */
export async function pluginInstallCommands(
  origin: SkillOrigin,
  claudeHome = join(homedir(), ".claude"),
): Promise<string[][] | null> {
  if (!origin.plugin || !origin.marketplace) return null;
  const known = (await readFile(join(claudeHome, "plugins", "known_marketplaces.json"), "utf8").then(JSON.parse).catch(() => ({}))) as Record<string, unknown>;
  const steps: string[][] = [];
  if (!(origin.marketplace in known)) {
    if (!origin.marketplaceSource) return null;
    steps.push(["claude", "plugin", "marketplace", "add", origin.marketplaceSource]);
  }
  steps.push(["claude", "plugin", "install", `${origin.plugin}@${origin.marketplace}`]);
  return steps;
}

/** Runs those commands with the Claude Code CLI (never through a shell). */
export async function runInstallCommands(steps: string[][]): Promise<void> {
  for (const argv of steps) {
    const proc = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
    const timer = setTimeout(() => proc.kill(), 120_000);
    const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    clearTimeout(timer);
    if (code !== 0) throw new Error((err || out).trim().split("\n").at(-1) || `Falló: ${argv.join(" ")}`);
  }
}
