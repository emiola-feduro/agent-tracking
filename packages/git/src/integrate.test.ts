import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { integrateBranch, pushErrorMessage } from "./integrate";
import { git } from "./run";

let tmp: string;
let remote: string;
let repo: string;
const id = ["-c", "user.email=t@t", "-c", "user.name=t"];
const commit = async (cwd: string, file: string, text: string, message = file) => {
  await writeFile(join(cwd, file), text);
  await git(["add", file], cwd);
  await git([...id, "commit", "-qm", message], cwd);
};
const head = async (ref: string, cwd = repo) => (await git(["rev-parse", ref], cwd)).stdout;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-integrate-test-"));
  remote = join(tmp, "remote.git");
  repo = join(tmp, "repo");
  await git(["init", "-q", "--bare", "-b", "main", remote]);
  await git(["init", "-q", "-b", "main", repo]);
  await git(["config", "user.email", "t@t"], repo);
  await git(["config", "user.name", "t"], repo);
  await commit(repo, "app.ts", "export const a = 1;\n");
  await git(["remote", "add", "origin", remote], repo);
  await git(["push", "-q", "origin", "main"], repo);
});
afterEach(() => rm(tmp, { recursive: true, force: true }));

describe("integrating a branch into main", () => {
  test("fast-forward and push", async () => {
    await git(["switch", "-q", "-c", "feat/a"], repo);
    await commit(repo, "a.ts", "a\n");
    await git(["switch", "-q", "main"], repo);
    const r = await integrateBranch(repo, "feat/a", "main", { push: true });
    expect(r).toMatchObject({ merge: "fast-forward", pushed: true, pushError: null });
    expect(await head("main")).toBe(await head("feat/a"));
    expect(await head("main", remote)).toBe(await head("feat/a"));
  });

  test("a merge commit when main moved on, done aside without touching the checkout", async () => {
    await git(["switch", "-q", "-c", "feat/b"], repo);
    await commit(repo, "b.ts", "b\n");
    await git(["switch", "-q", "main"], repo);
    await commit(repo, "other.ts", "o\n");
    const r = await integrateBranch(repo, "feat/b", "main", { push: true });
    expect(r.merge).toBe("merge-commit");
    expect((await git(["log", "-1", "--format=%s", "main"], repo)).stdout).toBe("merge: feat/b en main");
    expect(await Bun.file(join(repo, "b.ts")).exists()).toBe(true);
    expect((await git(["worktree", "list"], repo)).stdout.split("\n")).toHaveLength(1);
    expect(r.pushed).toBe(true);
  });

  test("conflicts stop everything and name the files", async () => {
    await git(["switch", "-q", "-c", "feat/c"], repo);
    await commit(repo, "app.ts", "export const a = 2;\n");
    await git(["switch", "-q", "main"], repo);
    await commit(repo, "app.ts", "export const a = 3;\n");
    const before = await head("main");
    await expect(integrateBranch(repo, "feat/c", "main")).rejects.toThrow("conflictos con main en: app.ts");
    expect(await head("main")).toBe(before);
    expect((await git(["status", "--porcelain"], repo)).stdout).toBe("");
    expect((await git(["worktree", "list"], repo)).stdout.split("\n")).toHaveLength(1);
  });

  test("unfinished work stops it; Agent Tracking data is committed first", async () => {
    await git(["switch", "-q", "-c", "feat/d"], repo);
    await commit(repo, "d.ts", "d\n");
    await git(["switch", "-q", "main"], repo);
    await writeFile(join(repo, "app.ts"), "a medio hacer\n");
    await expect(integrateBranch(repo, "feat/d", "main")).rejects.toThrow("Hay cambios sin commit en main");
    await git(["checkout", "--", "app.ts"], repo);

    await mkdir(join(repo, ".agent-tracking"));
    await writeFile(join(repo, ".agent-tracking/CONTEXT.md"), "# Contexto\n");
    const r = await integrateBranch(repo, "feat/d", "main");
    expect(r.trackingCommits).toEqual([repo]);
    expect((await git(["status", "--porcelain"], repo)).stdout).toBe("");
    expect(r.merge).toBe("merge-commit");
  });

  test("a rejected push keeps the integration and says what to do; the checkout can go back to main", async () => {
    // Someone else pushed to main meanwhile.
    const other = join(tmp, "other");
    await git(["clone", "-q", remote, other]);
    await commit(other, "theirs.ts", "t\n");
    await git(["push", "-q", "origin", "main"], other);

    await git(["switch", "-q", "-c", "feat/e"], repo);
    await commit(repo, "e.ts", "e\n");
    const r = await integrateBranch(repo, "feat/e", "main", { push: true, switchBack: true });
    expect(r.merge).toBe("fast-forward");
    expect(r.switchedBack).toBe(true);
    expect((await git(["branch", "--show-current"], repo)).stdout).toBe("main");
    expect(r.pushed).toBe(false);
    expect(r.pushError).toContain("trae los cambios");
  });

  test("push errors in plain words", () => {
    expect(pushErrorMessage("remote: Permission denied (publickey)")).toContain("credenciales");
    expect(pushErrorMessage("fatal: unable to access 'x': Could not resolve host: github.com")).toContain("conexión");
    expect(pushErrorMessage("remote: error: GH006: Protected branch update failed")).toContain("pull request");
  });
});
