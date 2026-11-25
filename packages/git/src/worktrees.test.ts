import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { branchProgress, diffSince, listWorktrees, mainWorktreeOf, readRepoFile, snapshotWorkingTree } from "./worktrees";
import { git } from "./run";

let tmp: string;
let repo: string;
const run = async (args: string[], cwd = repo) => {
  const r = await git(args, cwd);
  if (!r.ok) throw new Error(r.stderr);
  return r.stdout;
};

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-wt-"));
  repo = join(tmp, "repo");
  await run(["init", "-q", "-b", "main", repo], tmp);
  await run(["config", "user.email", "t@t"]);
  await run(["config", "user.name", "t"]);
  await writeFile(join(repo, "a.ts"), "export const a = 1;\n");
  await run(["add", "."]);
  await run(["commit", "-qm", "init"]);
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

describe("worktrees", () => {
  test("lists checkouts and measures what a branch did", async () => {
    const wt = join(tmp, "wt-feature");
    await run(["worktree", "add", "-q", "-b", "feature", wt]);
    await writeFile(join(wt, "b.ts"), "export const b = 2;\nexport const c = 3;\n");
    await run(["add", "."], wt);
    await run(["commit", "-qm", "add b"], wt);
    await writeFile(join(wt, "a.ts"), "export const a = 10;\n");

    const list = await listWorktrees(repo);
    expect(list.map((w) => [w.branch, w.main])).toEqual([["main", true], ["feature", false]]);
    expect(await mainWorktreeOf(wt)).toBe(repo);

    const progress = await branchProgress(wt, "main");
    expect(progress).toMatchObject({ ahead: 1, behind: 0, dirty: 1, files: 2, insertions: 3, deletions: 1 });
    expect(progress.lastCommit?.subject).toBe("add b");
  });
});

describe("turn diff", () => {
  test("only what changed after the snapshot, new files included", async () => {
    await writeFile(join(repo, "a.ts"), "export const a = 2;\n"); // already dirty before the turn
    const before = await snapshotWorkingTree(repo);
    await writeFile(join(repo, "a.ts"), "export const a = 3;\n");
    await writeFile(join(repo, "new.ts"), "hola\nmundo\n");
    const diff = await diffSince(repo, before);
    expect(diff.files).toEqual([
      { path: "a.ts", insertions: 1, deletions: 1, binary: false },
      { path: "new.ts", insertions: 2, deletions: 0, binary: false },
    ]);
    expect(diff.patch).toContain("-export const a = 2;");
    expect(diff.patch).not.toContain("-export const a = 1;");
    expect(diff.patch).toContain("+++ b/new.ts");
    expect((await git(["stash", "list"], repo)).stdout).toBe("");
  });

  test("file previews stay inside the repo", async () => {
    expect((await readRepoFile(repo, "a.ts")).content).toContain("export const a");
    await expect(readRepoFile(repo, "../x")).rejects.toThrow();
  });
});

describe("own files", () => {
  test("Agent Tracking's .agent-tracking folder never counts as someone's change", async () => {
    const before = await snapshotWorkingTree(repo);
    await Bun.write(join(repo, ".agent-tracking/CONTEXT.md"), "# x\n");
    await Bun.write(join(repo, "real.ts"), "x\n");
    const diff = await diffSince(repo, before);
    expect(diff.files.map((f) => f.path)).toEqual(["real.ts"]);
  });
});

describe("untracked files", () => {
  test("an untracked file edited during the turn shows up with only its new lines", async () => {
    await Bun.write(join(repo, "nuevo-sin-commit.ts"), "uno\n");
    const before = await snapshotWorkingTree(repo);
    await Bun.write(join(repo, "nuevo-sin-commit.ts"), "uno\ndos\n");
    const diff = await diffSince(repo, before);
    expect(diff.files.find((f) => f.path === "nuevo-sin-commit.ts")).toEqual({ path: "nuevo-sin-commit.ts", insertions: 1, deletions: 0, binary: false });
    expect(diff.patch).toContain("+++ b/nuevo-sin-commit.ts");
    expect(diff.patch).toContain("+dos");
    expect((await git(["status", "--porcelain"], repo)).stdout).toContain("?? nuevo-sin-commit.ts");
  });
});
