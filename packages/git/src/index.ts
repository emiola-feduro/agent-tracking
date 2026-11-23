import { readdir, stat } from "node:fs/promises";
import { basename, isAbsolute, resolve } from "node:path";

export type GitResult = { ok: boolean; stdout: string; stderr: string };

/** Runs git with an argument list (never through a shell). */
export async function git(args: string[], cwd?: string, timeoutMs = 120_000): Promise<GitResult> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
    // Never block waiting for credentials in a background server.
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  const timer = setTimeout(() => proc.kill(), timeoutMs);
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timer);
  return { ok: code === 0, stdout: stdout.trim(), stderr: stderr.trim() };
}

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
