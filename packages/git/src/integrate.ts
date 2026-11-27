import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { GitError } from "./repo";
import { git } from "./run";
import { listWorktrees } from "./worktrees";

/**
 * Bringing a work branch into the main branch and pushing it, the way it is done by hand, without
 * ever touching anyone's unfinished work:
 * - the merge happens in a temporary worktree, so no checkout changes branch or files midway;
 * - a fast-forward when possible, a merge commit otherwise; on conflicts nothing is left half done
 *   and the conflicting files are listed;
 * - the main branch moves only forward (fast-forward of its checkout, or a guarded ref update);
 * - the push is never forced. A failed push keeps the local integration and says why.
 * Uncommitted Agent Tracking data (.agent-tracking/) is committed first, as it would otherwise block
 * the update; any other uncommitted change stops everything with the list of files.
 */
export type IntegrateResult = {
  branch: string;
  base: string;
  merge: "fast-forward" | "merge-commit" | "already-merged";
  /** The base branch's new commit. */
  head: string;
  /** Commits of Agent Tracking data made first, by checkout path. */
  trackingCommits: string[];
  /** The main checkout was on the integrated branch and went back to the base branch. */
  switchedBack: boolean;
  pushed: boolean;
  /** Why the push did not happen (the integration itself is done). */
  pushError: string | null;
};

const TRACKING = ".agent-tracking/";

const must = async (args: string[], cwd: string, message: string) => {
  const res = await git(args, cwd);
  if (!res.ok) throw new GitError(`${message}: ${res.stderr.split("\n").filter(Boolean).at(-1) ?? "sin detalle"}`, "git_failed");
  return res.stdout;
};

/** Uncommitted paths of a checkout, split into Agent Tracking data and everything else. */
async function dirtyPaths(cwd: string) {
  const out = await must(["status", "--porcelain", "-uall"], cwd, "No se pudo leer el estado del repositorio");
  const paths = out.split("\n").filter(Boolean).map((l) => l.slice(3).replace(/^.* -> /, ""));
  return { tracking: paths.filter((p) => p.startsWith(TRACKING)), other: paths.filter((p) => !p.startsWith(TRACKING)) };
}

/** Plain-language reason of a failed push. */
export function pushErrorMessage(stderr: string): string {
  const text = stderr.toLowerCase();
  if (/rejected|fetch first|non-fast-forward/.test(text)) return "El remoto tiene commits que no están en este equipo: trae los cambios (git pull) e integra de nuevo.";
  if (/authentication|permission denied|could not read username|403/.test(text)) return "El remoto rechazó las credenciales: revisa tu acceso a GitHub (gh auth login o tu llave SSH).";
  if (/could not resolve host|unable to access|network/.test(text)) return "No se pudo conectar con el remoto: revisa la conexión a internet.";
  if (/protected branch|gh006/.test(text)) return "La rama principal del remoto está protegida: sube la rama y abre un pull request.";
  return `git push falló: ${stderr.split("\n").filter(Boolean).at(-1) ?? "sin detalle"}`;
}

export async function integrateBranch(
  root: string,
  branch: string,
  base: string,
  opts: { push?: boolean; remote?: string; switchBack?: boolean } = {},
): Promise<IntegrateResult> {
  if (branch === base) throw new GitError(`${branch} ya es la rama principal`, "invalid_ref");
  for (const ref of [branch, base]) {
    if (!(await git(["rev-parse", "--verify", "--quiet", `refs/heads/${ref}`], root)).ok) throw new GitError(`No existe la rama ${ref}`, "not_found");
  }
  const worktrees = await listWorktrees(root);
  const baseCheckout = worktrees.find((w) => w.branch === base)?.path ?? null;
  const branchCheckout = worktrees.find((w) => w.branch === branch)?.path ?? null;

  // Unfinished work stops everything; Agent Tracking's own data is committed where it is.
  const trackingCommits: string[] = [];
  for (const [cwd, which] of [[baseCheckout, base], [branchCheckout, branch]] as const) {
    if (!cwd) continue;
    const dirty = await dirtyPaths(cwd);
    if (dirty.other.length) {
      const list = dirty.other.slice(0, 8).join(", ") + (dirty.other.length > 8 ? ` y ${dirty.other.length - 8} más` : "");
      throw new GitError(`Hay cambios sin commit en ${which} (${cwd}): ${list}. Haz commit o guárdalos antes de integrar.`, "dirty", { path: cwd, files: dirty.other });
    }
    if (dirty.tracking.length) {
      await must(["add", "--", TRACKING], cwd, "No se pudieron preparar los datos de Agent Tracking");
      await must(["commit", "-q", "-m", "chore: update Agent Tracking data"], cwd, "No se pudo hacer commit de los datos de Agent Tracking");
      trackingCommits.push(cwd);
    }
  }

  const oldBase = await must(["rev-parse", `refs/heads/${base}`], root, "No se pudo leer la rama principal");
  const tip = await must(["rev-parse", `refs/heads/${branch}`], root, "No se pudo leer la rama");
  let merge: IntegrateResult["merge"];
  let head: string;
  if ((await git(["merge-base", "--is-ancestor", tip, oldBase], root)).ok) {
    merge = "already-merged";
    head = oldBase;
  } else if ((await git(["merge-base", "--is-ancestor", oldBase, tip], root)).ok) {
    merge = "fast-forward";
    head = tip;
  } else {
    merge = "merge-commit";
    head = await mergeInTemporaryWorktree(root, oldBase, branch, base);
  }

  if (head !== oldBase) {
    if (baseCheckout) await must(["merge", "-q", "--ff-only", head], baseCheckout, `No se pudo avanzar ${base} en ${baseCheckout}`);
    // Only from the commit read above: if someone moved the branch meanwhile, nothing is overwritten.
    else await must(["update-ref", `refs/heads/${base}`, head, oldBase], root, `No se pudo avanzar ${base}`);
  }

  let switchedBack = false;
  if (opts.switchBack && branchCheckout && resolve(branchCheckout) === resolve(root) && !baseCheckout) {
    switchedBack = (await git(["switch", "-q", base], root)).ok;
  }

  let pushed = false;
  let pushError: string | null = null;
  if (opts.push) {
    const remote = opts.remote ?? "origin";
    if (!(await git(["remote", "get-url", remote], root)).ok) pushError = `El repositorio no tiene el remoto ${remote}: la integración quedó solo en este equipo.`;
    else {
      const res = await git(["push", "-q", remote, `refs/heads/${base}:refs/heads/${base}`], root);
      pushed = res.ok;
      if (!res.ok) pushError = pushErrorMessage(res.stderr);
    }
  }
  return { branch, base, merge, head, trackingCommits, switchedBack, pushed, pushError };
}

/** Merges `branch` into the base commit in a throwaway worktree; returns the merge commit. */
async function mergeInTemporaryWorktree(root: string, baseCommit: string, branch: string, base: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "at-integrate-"));
  const path = join(dir, "checkout");
  await must(["worktree", "add", "-q", "--detach", path, baseCommit], root, "No se pudo preparar la integración");
  try {
    const res = await git(["merge", "-q", "--no-ff", "--no-edit", "-m", `merge: ${branch} en ${base}`, branch], path);
    if (!res.ok) {
      const conflicts = (await git(["diff", "--name-only", "--diff-filter=U"], path)).stdout.split("\n").filter(Boolean);
      await git(["merge", "--abort"], path);
      if (conflicts.length) {
        throw new GitError(
          `${branch} tiene conflictos con ${base} en: ${conflicts.join(", ")}. Resuélvelos en la rama (o pídeselo a un agente) e integra de nuevo; no se cambió nada.`,
          "unmerged",
          { conflicts },
        );
      }
      throw new GitError(`No se pudo fusionar ${branch}: ${res.stderr.split("\n").filter(Boolean).at(-1) ?? "sin detalle"}`, "git_failed");
    }
    return await must(["rev-parse", "HEAD"], path, "No se pudo leer el resultado de la fusión");
  } finally {
    await git(["worktree", "remove", "--force", path], root);
    await rm(dir, { recursive: true, force: true });
  }
}
