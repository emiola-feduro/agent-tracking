import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { GitError, resolveRepoPath } from "./repo";
import { git, gitRaw } from "./run";

export type Worktree = {
  path: string;
  /** Branch checked out there, or null when HEAD is detached. */
  branch: string | null;
  head: string;
  /** The repository's main checkout (the first one git lists). */
  main: boolean;
  locked: boolean;
  prunable: boolean;
};

/** Every checkout of the repository: the main one and those added with `git worktree add`. */
export async function listWorktrees(root: string): Promise<Worktree[]> {
  const res = await git(["worktree", "list", "--porcelain"], root);
  if (!res.ok) throw new GitError(res.stderr || "No se pudieron listar los worktrees", "git_failed");
  return res.stdout
    .split(/\n\n+/)
    .filter((block) => block.startsWith("worktree "))
    .map((block, i) => {
      const lines = block.split("\n");
      const value = (key: string) => lines.find((l) => l.startsWith(`${key} `))?.slice(key.length + 1) ?? null;
      const branch = value("branch");
      return {
        path: value("worktree")!,
        branch: branch ? branch.replace(/^refs\/heads\//, "") : null,
        head: value("HEAD") ?? "",
        main: i === 0,
        locked: lines.some((l) => l === "locked" || l.startsWith("locked ")),
        prunable: lines.some((l) => l.startsWith("prunable")),
      };
    })
    .filter((w) => w.head !== "" || w.branch !== null);
}

/** The main checkout of the repository that contains `path`, also when `path` is inside a worktree. */
export async function mainWorktreeOf(path: string): Promise<string | null> {
  const res = await git(["rev-parse", "--path-format=absolute", "--git-common-dir"], path);
  if (!res.ok || !res.stdout) return null;
  // A normal repo keeps its data in <root>/.git; bare repositories have no main checkout.
  return res.stdout.endsWith("/.git") ? dirname(res.stdout) : null;
}

export type BranchProgress = {
  /** Commits on this checkout not yet in the base branch, and the other way around. */
  ahead: number;
  behind: number;
  /** Files with uncommitted changes (tracked or new). */
  dirty: number;
  /** Changes against the point where it left the base, commits and uncommitted work together. */
  files: number;
  insertions: number;
  deletions: number;
  lastCommit: { sha: string; subject: string; date: string } | null;
};

/** How far a checkout has moved from `base` (for example main): what an agent did on its branch. */
export async function branchProgress(checkout: string, base: string | null): Promise<BranchProgress> {
  const [status, last] = await Promise.all([
    gitRaw(["status", "--porcelain", "-z"], checkout),
    git(["log", "-1", "--format=%H%x1f%s%x1f%cI"], checkout),
  ]);
  const dirty = status.ok ? status.stdout.split("\0").filter((l) => /^.. /.test(l) && !l.slice(3).startsWith(OWN_FILES)).length : 0;
  const [sha = "", subject = "", date = ""] = last.ok ? last.stdout.split("\x1f") : [];
  const lastCommit = sha ? { sha, subject, date } : null;
  let ahead = 0;
  let behind = 0;
  let from = "HEAD";
  if (base && lastCommit) {
    const counts = await git(["rev-list", "--left-right", "--count", `${base}...HEAD`], checkout);
    if (counts.ok) [behind, ahead] = counts.stdout.split(/\s+/).map(Number) as [number, number];
    const mergeBase = await git(["merge-base", base, "HEAD"], checkout);
    if (mergeBase.ok) from = mergeBase.stdout;
  }
  const stat = lastCommit ? await git(["diff", "--shortstat", from, "--", ".", NOT_OWN], checkout) : null;
  const n = (re: RegExp) => Number(re.exec(stat?.stdout ?? "")?.[1] ?? 0);
  return {
    ahead,
    behind,
    dirty,
    files: n(/(\d+) files? changed/),
    insertions: n(/(\d+) insertions?/),
    deletions: n(/(\d+) deletions?/),
    lastCommit,
  };
}

const MAX_PREVIEW = 400_000;

export type FileContent = { path: string; content: string; lines: number; truncated: boolean; binary: boolean };

/** A file of the working tree for previews. Binary files and very large ones come back without content. */
export async function readRepoFile(root: string, path: string): Promise<FileContent> {
  const { absolute, relative } = await resolveRepoPath(root, path);
  const info = await stat(absolute).catch(() => null);
  if (!info?.isFile()) throw new GitError(`No existe el archivo ${relative}`, "not_found");
  const buffer = await readFile(absolute);
  const head = buffer.subarray(0, 8000);
  if (head.includes(0)) return { path: relative, content: "", lines: 0, truncated: false, binary: true };
  const truncated = buffer.length > MAX_PREVIEW;
  const content = buffer.subarray(0, MAX_PREVIEW).toString("utf8");
  return { path: relative, content, lines: content.split("\n").length, truncated, binary: false };
}

/**
 * What the working tree looked like at a moment, without touching it (no stash entry, no index
 * change). Untracked files are kept as "<blob> <path>" so later edits to them show up too; their
 * contents go into git's object store as loose objects that nothing references.
 */
export type TreeSnapshot = { commit: string | null; untracked: string[] };

const MAX_UNTRACKED = 500;
const MAX_UNTRACKED_BYTES = 1_000_000;
const BLOB_ENTRY = /^([0-9a-f]{40,64}) (.+)$/;

export async function snapshotWorkingTree(root: string): Promise<TreeSnapshot> {
  // `stash create` builds a commit of tracked changes and prints nothing when the tree is clean.
  const [stash, head, untracked] = await Promise.all([
    git(["stash", "create"], root),
    git(["rev-parse", "--verify", "-q", "HEAD"], root),
    git(["ls-files", "-z", "--others", "--exclude-standard"], root),
  ]);
  const commit = stash.ok && stash.stdout ? stash.stdout : head.ok && head.stdout ? head.stdout : null;
  const paths = untracked.ok ? untracked.stdout.split("\0").filter(Boolean) : [];
  const small: string[] = [];
  for (const p of paths.slice(0, MAX_UNTRACKED)) {
    const size = await stat(join(root, p)).then((x) => (x.isFile() ? x.size : -1)).catch(() => -1);
    if (size >= 0 && size <= MAX_UNTRACKED_BYTES) small.push(p);
  }
  const hashes = small.length ? await git(["hash-object", "-w", "--", ...small], root) : null;
  const blobs = hashes?.ok ? hashes.stdout.split("\n") : [];
  return { commit, untracked: paths.map((p) => (small.includes(p) && blobs[small.indexOf(p)] ? `${blobs[small.indexOf(p)]} ${p}` : p)) };
}

export type DiffFile = { path: string; insertions: number; deletions: number; binary: boolean };
export type TurnDiff = { files: DiffFile[]; patch: string; truncated: boolean };

const MAX_PATCH = 400_000;
/** Agent Tracking's own files (project.json, CONTEXT.md, images) are not part of anyone's work. */
const OWN_FILES = ".agent-tracking/";
const NOT_OWN = `:(exclude)${OWN_FILES}`;

/**
 * Changes made since a snapshot: edits to files that existed (committed or not) and files created
 * meanwhile. Pre-existing uncommitted work is part of the snapshot, so it does not show up again.
 */
export async function diffSince(root: string, since: TreeSnapshot): Promise<TurnDiff> {
  const before = new Map(since.untracked.map((e) => {
    const m = BLOB_ENTRY.exec(e);
    return m ? [m[2]!, m[1]!] : [e, null];
  }));
  const nowUntracked = (await git(["ls-files", "-z", "--others", "--exclude-standard"], root)).stdout.split("\0").filter(Boolean);
  const created = nowUntracked.filter((p) => !before.has(p) && !p.startsWith(OWN_FILES)).slice(0, 200);
  // Untracked before and still untracked, but edited since: compare against the stored blob.
  const edited: { path: string; blob: string }[] = [];
  for (const p of nowUntracked) {
    const blob = before.get(p);
    if (!blob || p.startsWith(OWN_FILES)) continue;
    const now = await git(["hash-object", "--", p], root);
    if (now.ok && now.stdout !== blob) edited.push({ path: p, blob });
  }
  const parts: string[] = [];
  const files: DiffFile[] = [];
  if (since.commit) {
    const [numstat, patch] = await Promise.all([
      git(["diff", "--numstat", "-M", since.commit, "--", ".", NOT_OWN], root),
      gitRaw(["diff", "--no-color", "-M", since.commit, "--", ".", NOT_OWN], root),
    ]);
    for (const line of numstat.stdout.split("\n").filter(Boolean)) {
      const [add = "0", del = "0", ...rest] = line.split("\t");
      files.push({ path: rest.join("\t").replace(/^.*\{(.*) => (.*)\}.*$/, (_m, _a, b) => b), insertions: Number(add) || 0, deletions: Number(del) || 0, binary: add === "-" });
    }
    if (patch.stdout) parts.push(patch.stdout);
  }
  for (const path of created) {
    const res = await gitRaw(["diff", "--no-color", "--no-index", "--", "/dev/null", join(root, path)], root);
    // --no-index exits with 1 when the files differ, which is always the case here.
    const patch = res.stdout.replaceAll(`b${join(root, path)}`, `b/${path}`).replaceAll(`${root}/`, "");
    parts.push(patch);
    const binary = /^Binary files/m.test(patch);
    files.push({ path, insertions: binary ? 0 : (patch.match(/^\+(?!\+\+)/gm) ?? []).length, deletions: 0, binary });
  }
  for (const { path, blob } of edited.slice(0, 200)) {
    const fresh = await git(["hash-object", "-w", "--", path], root);
    if (!fresh.ok) continue;
    const res = await gitRaw(["diff", "--no-color", blob, fresh.stdout], root);
    const body = res.stdout.replace(/^diff --git a\/\S+ b\/\S+$/m, `diff --git a/${path} b/${path}`).replace(/^--- a\/\S+$/m, `--- a/${path}`).replace(/^\+\+\+ b\/\S+$/m, `+++ b/${path}`);
    parts.push(body);
    files.push({
      path,
      insertions: (body.match(/^\+(?!\+\+)/gm) ?? []).length,
      deletions: (body.match(/^-(?!--)/gm) ?? []).length,
      binary: /^Binary files/m.test(body),
    });
  }
  const patch = parts.join("");
  return { files, patch: patch.slice(0, MAX_PATCH), truncated: patch.length > MAX_PATCH };
}
