import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, resolve, sep } from "node:path";
import { git } from "./run";

export { git, gitRaw, listRepoFiles, type GitResult } from "./run";
export * from "./repo";
export * from "./watch";

export type RepoInfo = {
  /** Absolute path of the repository root (may differ from the path given). */
  root: string;
  name: string;
  branch: string | null;
  remoteUrl: string | null;
};

/** Returns repository info, or null if the path is not inside a git repository. */
export async function inspectRepo(path: string): Promise<RepoInfo | null> {
  if (!isAbsolute(path)) return null;
  const isDir = await stat(path).then((s) => s.isDirectory()).catch(() => false);
  if (!isDir) return null;
  const top = await git(["rev-parse", "--show-toplevel"], path);
  if (!top.ok) return null;
  const root = top.stdout;
  const [branch, remote] = await Promise.all([
    git(["symbolic-ref", "--short", "-q", "HEAD"], root),
    git(["remote", "get-url", "origin"], root),
  ]);
  return {
    root,
    name: basename(root),
    branch: branch.ok && branch.stdout ? branch.stdout : null,
    remoteUrl: remote.ok ? toHttpsUrl(remote.stdout) : null,
  };
}

const GITHUB_URL = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/;

/** Normalizes `git@github.com:org/repo.git` and https variants to `https://github.com/org/repo`. */
export function toHttpsUrl(url: string): string {
  const ssh = url.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (ssh) return `https://github.com/${ssh[1]}/${ssh[2]}`;
  const https = url.match(GITHUB_URL);
  return https ? `https://github.com/${https[1]}/${https[2]}` : url;
}

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const m = url.trim().match(GITHUB_URL);
  return m ? { owner: m[1]!, repo: m[2]! } : null;
}

/** Clones a GitHub repository into `dest`, which must not exist or be empty. */
export async function cloneGithub(url: string, dest: string): Promise<RepoInfo> {
  const gh = parseGithubUrl(url);
  if (!gh) throw new Error("La URL debe tener la forma https://github.com/organizacion/repositorio");
  if (!isAbsolute(dest)) throw new Error("La carpeta destino debe ser una ruta absoluta");
  const target = resolve(dest);
  const entries = await readdir(target).catch(() => null);
  if (entries && entries.length > 0) throw new Error(`La carpeta ${target} ya existe y no está vacía`);
  const res = await git(["clone", "--", `https://github.com/${gh.owner}/${gh.repo}.git`, target]);
  if (!res.ok) throw new Error(res.stderr.split("\n").at(-1) || "No se pudo clonar el repositorio");
  const info = await inspectRepo(target);
  if (!info) throw new Error("El clon no es un repositorio válido");
  return info;
}

/**
 * Creates a new repository in an empty (or missing) folder, on branch main. Nothing is committed:
 * the first commit is the person's or the agent's.
 */
export async function initRepo(dest: string): Promise<RepoInfo> {
  if (!isAbsolute(dest)) throw new Error("La carpeta debe ser una ruta absoluta");
  const target = resolve(dest);
  const entries = await readdir(target).catch(() => null);
  if (entries && entries.length > 0) {
    const existing = await inspectRepo(target);
    throw new Error(
      existing
        ? `${target} ya es un repositorio git: elige "Repositorio local"`
        : `La carpeta ${target} ya existe y no está vacía`,
    );
  }
  await mkdir(target, { recursive: true });
  const res = await git(["init", "-q", "-b", "main", target]);
  if (!res.ok) throw new Error(res.stderr.split("\n").at(-1) || "No se pudo crear el repositorio");
  const info = await inspectRepo(target);
  if (!info) throw new Error("No se pudo crear el repositorio");
  return info;
}

/** Writes files into a repository, skipping any that already exist. Returns the paths it wrote. */
export async function writeNewFiles(root: string, files: { path: string; content: string }[]): Promise<string[]> {
  const written: string[] = [];
  for (const file of files) {
    const target = resolve(root, file.path);
    if (!target.startsWith(resolve(root) + sep)) throw new Error(`Ruta fuera del repositorio: ${file.path}`);
    if (await stat(target).then(() => true, () => false)) continue;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content);
    written.push(file.path);
  }
  return written;
}
