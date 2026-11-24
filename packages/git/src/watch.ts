import { watch, type FSWatcher } from "node:fs";
import { sep } from "node:path";
import { git } from "./run";

export type WatchOptions = {
  /** Quiet period before a batch of changes is delivered (default 300 ms). */
  debounceMs?: number;
  /** Extra filter applied after the built-in ignores; return false to drop a path. */
  filter?: (relPath: string) => boolean;
  onError?: (err: unknown) => void;
};

export type RepoWatcher = { close(): void };

/** Directories that are never reported, whatever .gitignore says. */
const ALWAYS_IGNORED = new Set([".git", "node_modules"]);

export const isAlwaysIgnored = (relPath: string) => relPath.split("/").some((segment) => ALWAYS_IGNORED.has(segment));

/** Returns the subset of repo-relative paths that .gitignore (and .git/info/exclude, global excludes) ignores. */
export async function gitIgnored(root: string, paths: string[]): Promise<Set<string>> {
  if (paths.length === 0) return new Set();
  const proc = Bun.spawn(["git", "check-ignore", "-z", "--stdin"], {
    cwd: root,
    stdin: new TextEncoder().encode(paths.join("\0") + "\0"),
    stdout: "pipe",
    stderr: "ignore",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  const out = await new Response(proc.stdout).text();
  await proc.exited; // exit code 1 just means "nothing ignored"
  return new Set(out.split("\0").filter(Boolean));
}

/**
 * Watches a repository recursively and calls `onChange` with the repo-relative POSIX paths that changed,
 * batched with a debounce. Ignores `.git`, `node_modules` and anything matched by `.gitignore`.
 * Deleted files are reported too: callers should check whether each path still exists.
 */
export function watchRepo(root: string, onChange: (paths: string[]) => void, opts: WatchOptions = {}): RepoWatcher {
  const debounceMs = opts.debounceMs ?? 300;
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const flush = async () => {
    timer = undefined;
    const batch = [...pending];
    pending.clear();
    try {
      const ignored = await gitIgnored(root, batch);
      const paths = batch.filter((p) => !ignored.has(p) && (opts.filter?.(p) ?? true)).sort();
      if (paths.length > 0 && !closed) onChange(paths);
    } catch (err) {
      opts.onError?.(err);
    }
  };

  const watcher: FSWatcher = watch(root, { recursive: true }, (_event, filename) => {
    if (!filename || closed) return;
    const rel = filename.toString().split(sep).join("/");
    if (isAlwaysIgnored(rel)) return;
    pending.add(rel);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  });
  watcher.on("error", (err) => opts.onError?.(err));

  return {
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      watcher.close();
    },
  };
}

/**
 * Calls `onChange` when the repository switches branch (HEAD is rewritten by checkout, switch,
 * rebase and friends). The recursive watcher skips `.git`, so HEAD gets its own small watcher.
 */
export async function watchHead(root: string, onChange: () => void, opts: { debounceMs?: number; onError?: (err: unknown) => void } = {}): Promise<RepoWatcher> {
  const res = await git(["rev-parse", "--absolute-git-dir"], root);
  if (!res.ok || !res.stdout) return { close() {} };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  // Git replaces HEAD through HEAD.lock + rename, so watch the directory, not the file.
  const watcher = watch(res.stdout, (_event, filename) => {
    if (closed || filename?.toString() !== "HEAD") return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => !closed && onChange(), opts.debounceMs ?? 200);
  });
  watcher.on("error", (err) => opts.onError?.(err));
  return {
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      watcher.close();
    },
  };
}
