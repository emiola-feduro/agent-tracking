import { git } from "./run";

/**
 * Registers a custom merge driver in the repository's own config (.git/config, shared by its
 * worktrees). Only touches `merge.<name>.*` and only when it differs. Returns true when it wrote.
 */
export async function ensureMergeDriver(root: string, name: string, label: string, command: string): Promise<boolean> {
  const key = `merge.${name}.driver`;
  const current = await git(["config", "--local", "--get", key], root);
  if (current.ok && current.stdout === command) return false;
  const set = await git(["config", "--local", key, command], root);
  if (!set.ok) throw new Error(set.stderr || "No se pudo registrar el driver de merge");
  await git(["config", "--local", `merge.${name}.name`, label], root);
  return true;
}

/**
 * Line-based three-way merge with conflict markers, written into `ours` (what git does when no driver
 * is set). Returns true when it merged cleanly.
 */
export async function mergeFileAsText(ours: string, base: string, theirs: string): Promise<boolean> {
  const res = await git(["merge-file", "-L", "ours", "-L", "base", "-L", "theirs", ours, base, theirs]);
  return res.ok;
}
