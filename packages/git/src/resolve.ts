import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import { GitError, workingTreeChanges } from "./repo";
import { git, gitRaw } from "./run";
import { listWorktrees } from "./worktrees";

const last = (stderr: string) => stderr.split("\n").filter(Boolean).at(-1) ?? "sin detalle";
const must = async (args: string[], cwd: string, message: string) => {
  const res = await git(args, cwd);
  if (!res.ok) throw new GitError(`${message}: ${last(res.stderr)}`, "git_failed");
  return res.stdout;
};

/** Paths must be relative, inside the repository. */
const safePath = (path: string) => {
  if (!path || path.startsWith("/") || path.split(/[\\/]/).includes("..")) throw new GitError(`Ruta no válida: ${path}`, "invalid_path");
  return path;
};

/**
 * Commits the chosen changed files of a checkout (new, modified or deleted), only those, with the
 * person's message. Returns the new commit.
 */
export async function commitFiles(cwd: string, paths: string[], message: string): Promise<{ sha: string; files: number }> {
  const text = message.trim();
  if (!text) throw new GitError("Escribe el mensaje del commit", "invalid_ref");
  if (!paths.length) throw new GitError("Elige al menos un archivo", "invalid_path");
  const changed = new Map((await workingTreeChanges(cwd)).map((f) => [f.path, f]));
  for (const p of paths) {
    safePath(p);
    if (!changed.has(p)) throw new GitError(`${p} no tiene cambios`, "not_found");
    if (changed.get(p)!.status === "unmerged") throw new GitError(`${p} tiene conflictos sin resolver`, "unmerged");
  }
  await must(["add", "-A", "--", ...paths], cwd, "No se pudieron preparar los archivos");
  await must(["commit", "-q", "-m", text, "--", ...paths], cwd, "No se pudo hacer el commit");
  return { sha: await must(["rev-parse", "HEAD"], cwd, "No se pudo leer el commit"), files: paths.length };
}

/**
 * Resolving the conflicts between a work branch and the main one without a terminal: the main branch
 * is merged into the work branch in a throwaway worktree, the person settles each file (keep one
 * side, or write the result), and finishing commits the merge and moves the work branch forward.
 * The branch then integrates into main without conflicts. Nothing changes until finishing.
 */
export type MergeSession = {
  id: string;
  root: string;
  branch: string;
  base: string;
  /** Throwaway worktree where the merge happens. */
  path: string;
  branchTip: string;
  conflicts: string[];
};

export type ConflictFile = {
  path: string;
  /** The work branch's version (null: deleted there). */
  branch: string | null;
  /** The main branch's version (null: deleted there). */
  base: string | null;
  /** The file as git left it, with conflict markers. */
  merged: string;
  resolved: boolean;
};

const unmerged = async (cwd: string) => (await git(["diff", "--name-only", "--diff-filter=U"], cwd)).stdout.split("\n").filter(Boolean);

export async function startMergeSession(root: string, branch: string, base: string): Promise<MergeSession> {
  if (branch === base) throw new GitError(`${branch} ya es la rama principal`, "invalid_ref");
  const branchTip = await must(["rev-parse", "--verify", `refs/heads/${branch}`], root, `No existe la rama ${branch}`);
  await must(["rev-parse", "--verify", `refs/heads/${base}`], root, `No existe la rama ${base}`);
  const dir = await mkdtemp(join(tmpdir(), "at-resolve-"));
  const path = join(dir, "checkout");
  await must(["worktree", "add", "-q", "--detach", path, branchTip], root, "No se pudo preparar la resolución");
  const res = await git(["merge", "--no-ff", "--no-commit", base], path);
  const conflicts = await unmerged(path);
  if (!res.ok && conflicts.length === 0) {
    await discard({ root, path });
    throw new GitError(`No se pudo traer ${base} a ${branch}: ${last(res.stderr)}`, "git_failed");
  }
  return { id: crypto.randomUUID(), root, branch, base, path, branchTip, conflicts };
}

export async function conflictFile(session: MergeSession, path: string): Promise<ConflictFile> {
  if (!session.conflicts.includes(safePath(path))) throw new GitError(`${path} no está entre los conflictos`, "not_found");
  const show = async (stage: 2 | 3) => {
    // Untouched output: the file's exact bytes, final newline included.
    const res = await gitRaw(["show", `:${stage}:${path}`], session.path);
    return res.ok ? res.stdout : null;
  };
  const stillUnmerged = (await unmerged(session.path)).includes(path);
  return {
    path,
    branch: stillUnmerged ? await show(2) : null,
    base: stillUnmerged ? await show(3) : null,
    merged: await readFile(join(session.path, path), "utf8").catch(() => ""),
    resolved: !stillUnmerged,
  };
}

/** Settles one file: keep the work branch's or the main branch's version, or the given content. */
export async function resolveConflict(session: MergeSession, path: string, choice: { take: "branch" | "base" } | { content: string }) {
  if (!session.conflicts.includes(safePath(path))) throw new GitError(`${path} no está entre los conflictos`, "not_found");
  if ("content" in choice) {
    if (/^(<{7}|>{7}) /m.test(choice.content)) throw new GitError(`${path} todavía tiene marcas de conflicto (<<<<<<< o >>>>>>>)`, "unmerged");
    await writeFile(join(session.path, path), choice.content);
    await must(["add", "--", path], session.path, `No se pudo marcar ${path} como resuelto`);
    return;
  }
  const side = choice.take === "branch" ? "--ours" : "--theirs";
  const res = await git(["checkout", side, "--", path], session.path);
  // That side deleted the file: resolving it is deleting it.
  if (!res.ok) await must(["rm", "-q", "--", path], session.path, `No se pudo resolver ${path}`);
  else await must(["add", "--", path], session.path, `No se pudo marcar ${path} como resuelto`);
}

export async function pendingConflicts(session: MergeSession) {
  return unmerged(session.path);
}

/** Commits the merge and moves the work branch to it (its checkout, if any, by fast-forward). */
export async function finishMergeSession(session: MergeSession): Promise<{ sha: string }> {
  const left = await unmerged(session.path);
  if (left.length) throw new GitError(`Faltan por resolver: ${left.join(", ")}`, "unmerged", { conflicts: left });
  await must(["commit", "-q", "--no-edit", "-m", `merge: ${session.base} en ${session.branch} (conflictos resueltos en Agent Tracking)`], session.path, "No se pudo guardar la fusión");
  const sha = await must(["rev-parse", "HEAD"], session.path, "No se pudo leer la fusión");
  const checkout = (await listWorktrees(session.root)).find((w) => w.branch === session.branch && resolvePath(w.path) !== resolvePath(session.path));
  if (checkout) {
    const res = await git(["merge", "-q", "--ff-only", sha], checkout.path);
    if (!res.ok) throw new GitError(`La fusión quedó lista, pero no se pudo avanzar ${session.branch} en ${checkout.path}: ${last(res.stderr)}. Haz commit o guarda sus cambios y vuelve a intentarlo.`, "dirty");
  } else {
    await must(["update-ref", `refs/heads/${session.branch}`, sha, session.branchTip], session.root, `No se pudo avanzar ${session.branch}`);
  }
  await discard(session);
  return { sha };
}

/** Drops the session and its worktree; the branches stay as they were. */
export async function discard(session: Pick<MergeSession, "root" | "path">) {
  await git(["merge", "--abort"], session.path);
  await git(["worktree", "remove", "--force", session.path], session.root);
  await rm(join(session.path, ".."), { recursive: true, force: true });
}
