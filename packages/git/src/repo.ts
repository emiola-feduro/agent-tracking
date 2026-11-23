import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { git, gitRaw } from "./run";

/** Error with a user-facing (Spanish) message and a machine-readable code. */
export class GitError extends Error {
  constructor(
    message: string,
    readonly code: "not_repo" | "invalid_ref" | "not_found" | "dirty" | "invalid_path" | "too_large" | "git_failed",
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "GitError";
  }
}

const fail = (stderr: string, fallback: string) =>
  new GitError(stderr.split("\n").filter(Boolean).at(-1) || fallback, "git_failed");

/** Rejects relative roots and anything that is not the top level of a git repository. */
export async function assertRepoRoot(root: string): Promise<string> {
  if (!isAbsolute(root)) throw new GitError("La ruta del repositorio debe ser absoluta", "invalid_path");
  const top = await git(["rev-parse", "--show-toplevel"], root).catch(() => null);
  if (!top?.ok) throw new GitError(`${root} no es un repositorio git`, "not_repo");
  return top.stdout;
}

/**
 * Resolves `path` (absolute or relative to `root`) and guarantees it stays inside the repository,
 * following symlinks when the target exists. Returns the absolute path and the repo-relative POSIX path.
 */
export async function resolveRepoPath(root: string, path: string): Promise<{ absolute: string; relative: string }> {
  if (!isAbsolute(root)) throw new GitError("La ruta del repositorio debe ser absoluta", "invalid_path");
  if (!path || path.includes("\0")) throw new GitError("Ruta de archivo vacía o inválida", "invalid_path");
  const realRoot = await realpath(root).catch(() => resolve(root));
  const candidate = resolve(root, path);
  const real = await realpath(candidate).catch(() => candidate);
  for (const [base, p] of [[resolve(root), candidate], [realRoot, real]] as const) {
    const rel = relative(base, p);
    if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
      throw new GitError("La ruta debe estar dentro del repositorio", "invalid_path");
    }
  }
  const rel = relative(resolve(root), candidate);
  return { absolute: candidate, relative: rel.split(sep).join("/") };
}

/** Refs come from users: forbid option-looking values and anything git would not accept as a revision. */
async function verifyCommitish(root: string, ref: string): Promise<string> {
  if (!ref || ref.startsWith("-") || /[\0\s]/.test(ref)) throw new GitError(`Referencia inválida: ${ref}`, "invalid_ref");
  const res = await git(["rev-parse", "--verify", "--quiet", "--end-of-options", `${ref}^{commit}`], root);
  if (!res.ok) throw new GitError(`No existe la referencia ${ref}`, "not_found");
  return res.stdout;
}

export type Branch = {
  name: string;
  sha: string;
  current: boolean;
  upstream: string | null;
  /** ISO date of the branch tip commit. */
  lastCommitDate: string;
  subject: string;
};

/** Local branches (refs/heads), current branch first, then by most recent commit. */
export async function listBranches(root: string): Promise<Branch[]> {
  const fmt = ["%(refname:short)", "%(objectname)", "%(HEAD)", "%(upstream:short)", "%(committerdate:iso-strict)", "%(contents:subject)"].join("%1f");
  const res = await git(["for-each-ref", `--format=${fmt}`, "--sort=-committerdate", "refs/heads"], root);
  if (!res.ok) throw fail(res.stderr, "No se pudieron listar las ramas");
  return res.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [name = "", sha = "", head, upstream, date = "", subject = ""] = line.split("\x1f");
      return { name, sha, current: head === "*", upstream: upstream || null, lastCommitDate: date, subject };
    })
    .sort((a, b) => Number(b.current) - Number(a.current));
}

/** Current branch name, or null when HEAD is detached (or the repo has no commits yet on an unborn branch). */
export async function currentBranch(root: string): Promise<string | null> {
  const res = await git(["symbolic-ref", "--short", "-q", "HEAD"], root);
  return res.ok && res.stdout ? res.stdout : null;
}

export type FileStatus = "added" | "modified" | "deleted" | "renamed" | "copied" | "typechange" | "untracked" | "unmerged";
export type ChangedFile = {
  path: string;
  status: FileStatus;
  /** Previous path for renames and copies. */
  oldPath?: string;
  /** Working tree only: whether the change is in the index (staged), the worktree, or both. */
  staged?: boolean;
  unstaged?: boolean;
};

const STATUS: Record<string, FileStatus> = {
  A: "added", M: "modified", D: "deleted", R: "renamed", C: "copied", T: "typechange", U: "unmerged", "?": "untracked",
};

/** Parses `--name-status -z` tokens (status, path[, newPath]). */
function parseNameStatus(tokens: string[]): ChangedFile[] {
  const out: ChangedFile[] = [];
  for (let i = 0; i < tokens.length; ) {
    const code = tokens[i++]!.trim();
    if (!code) continue;
    const status = STATUS[code[0]!] ?? "modified";
    if (status === "renamed" || status === "copied") {
      const oldPath = tokens[i++]!;
      out.push({ path: tokens[i++]!, status, oldPath });
    } else {
      out.push({ path: tokens[i++]!, status });
    }
  }
  return out;
}

/** Uncommitted changes in the working tree (tracked and untracked, honoring .gitignore). */
export async function workingTreeChanges(root: string): Promise<ChangedFile[]> {
  const res = await gitRaw(["status", "--porcelain=v1", "-z", "--untracked-files=all"], root);
  if (!res.ok) throw fail(res.stderr, "No se pudo leer el estado del repositorio");
  const tokens = res.stdout.split("\0");
  const out: ChangedFile[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const entry = tokens[i]!;
    if (entry.length < 4) continue;
    const x = entry[0]!, y = entry[1]!, path = entry.slice(3);
    if (x === "?") {
      out.push({ path, status: "untracked", staged: false, unstaged: true });
      continue;
    }
    const conflict = x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D");
    const code = conflict ? "U" : x !== " " ? x : y;
    const file: ChangedFile = { path, status: STATUS[code] ?? "modified", staged: x !== " " && !conflict, unstaged: y !== " " || conflict };
    if (x === "R" || x === "C") file.oldPath = tokens[++i];
    out.push(file);
  }
  return out;
}

/** Files changed between two refs (`from..to`; `to` defaults to HEAD). */
export async function changedFilesBetween(root: string, from: string, to = "HEAD"): Promise<ChangedFile[]> {
  const [a, b] = await Promise.all([verifyCommitish(root, from), verifyCommitish(root, to)]);
  const res = await git(["diff", "--name-status", "-z", "-M", a, b, "--"], root);
  if (!res.ok) throw fail(res.stderr, "No se pudieron comparar las referencias");
  return parseNameStatus(res.stdout.split("\0"));
}

/**
 * Switches to an existing local branch. Refuses when tracked files have uncommitted changes
 * (untracked files are left alone; git itself refuses if the switch would overwrite one).
 */
export async function checkoutBranch(root: string, branch: string): Promise<{ branch: string; previous: string | null }> {
  if (!branch || branch.startsWith("-") || /[\0\s]/.test(branch)) throw new GitError(`Nombre de rama inválido: ${branch}`, "invalid_ref");
  const fmt = await git(["check-ref-format", "--branch", branch], root);
  if (!fmt.ok) throw new GitError(`Nombre de rama inválido: ${branch}`, "invalid_ref");
  const exists = await git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], root);
  if (!exists.ok) throw new GitError(`La rama ${branch} no existe en el repositorio local`, "not_found");

  const previous = await currentBranch(root);
  if (previous === branch) return { branch, previous };
  const dirty = (await workingTreeChanges(root)).filter((f) => f.status !== "untracked");
  if (dirty.length > 0) {
    const list = dirty.slice(0, 5).map((f) => f.path).join(", ") + (dirty.length > 5 ? ` y ${dirty.length - 5} más` : "");
    throw new GitError(
      `No se puede cambiar a ${branch}: hay ${dirty.length} archivo(s) con cambios sin commit (${list}). Haz commit o descártalos primero.`,
      "dirty",
      { files: dirty.map((f) => f.path) },
    );
  }
  const res = await git(["switch", "--no-guess", branch], root);
  if (!res.ok) throw fail(res.stderr, `No se pudo cambiar a la rama ${branch}`);
  return { branch, previous };
}

export type Commit = {
  sha: string;
  shortSha: string;
  parents: string[];
  author: { name: string; email: string };
  /** Author date, ISO 8601. */
  date: string;
  subject: string;
  body: string;
  files: ChangedFile[];
};

export type LogOptions = {
  /** Branch, tag or sha to start from (default HEAD). */
  ref?: string;
  limit?: number;
  skip?: number;
  /** Restrict to commits touching this repo-relative path. */
  path?: string;
};

/** Commit history with author, date and changed files (merge commits list no files). */
export async function commitLog(root: string, opts: LogOptions = {}): Promise<Commit[]> {
  const limit = Math.min(Math.max(1, Math.floor(opts.limit ?? 50)), 500);
  const skip = Math.max(0, Math.floor(opts.skip ?? 0));
  const ref = opts.ref ? await verifyCommitish(root, opts.ref) : "HEAD";
  if (!opts.ref) {
    const hasHead = await git(["rev-parse", "--verify", "--quiet", "HEAD"], root);
    if (!hasHead.ok) return [];
  }
  const args = [
    "log", "-z", "-M", "--name-status",
    `--max-count=${limit}`, `--skip=${skip}`,
    "--format=%x1e%H%x1f%h%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%b%x1f",
    ref, "--",
  ];
  if (opts.path) args.push((await resolveRepoPath(root, opts.path)).relative);
  const res = await git(args, root);
  if (!res.ok) throw fail(res.stderr, "No se pudo leer el historial");
  return res.stdout
    .split("\x1e")
    .filter((r) => r.trim())
    .map((record) => {
      const [sha = "", shortSha = "", parents = "", name = "", email = "", date = "", subject = "", body = "", rest = ""] = record.split("\x1f");
      return {
        sha, shortSha, date, subject,
        parents: parents.split(" ").filter(Boolean),
        author: { name, email },
        body: body.trim(),
        files: parseNameStatus(rest.replace(/^\0?\n?/, "").split("\0")),
      };
    });
}
