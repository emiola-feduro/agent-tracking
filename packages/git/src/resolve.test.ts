import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { integrateBranch } from "./integrate";
import { commitFiles, conflictFile, discard, finishMergeSession, resolveConflict, startMergeSession } from "./resolve";
import { git } from "./run";

let tmp: string;
let repo: string;
const commit = async (file: string, text: string) => {
  await writeFile(join(repo, file), text);
  await git(["add", file], repo);
  await git(["commit", "-qm", file], repo);
};
const read = (file: string) => Bun.file(join(repo, file)).text();

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-resolve-test-"));
  repo = join(tmp, "repo");
  await git(["init", "-q", "-b", "main", repo]);
  await git(["config", "user.email", "t@t"], repo);
  await git(["config", "user.name", "t"], repo);
  await commit("app.ts", "export const a = 1;\n");
  await commit("otro.ts", "x\n");
  // A branch and main that changed the same lines.
  await git(["switch", "-q", "-c", "feat/a"], repo);
  await commit("app.ts", "export const a = 2;\n");
  await commit("otro.ts", "rama\n");
  await git(["switch", "-q", "main"], repo);
  await commit("app.ts", "export const a = 3;\n");
  await commit("otro.ts", "main\n");
});
afterEach(() => rm(tmp, { recursive: true, force: true }));

describe("committing from the app", () => {
  test("only the chosen files, with the message", async () => {
    await writeFile(join(repo, "nuevo.ts"), "n\n");
    await writeFile(join(repo, "app.ts"), "export const a = 4;\n");
    const { files } = await commitFiles(repo, ["nuevo.ts"], "feat: nuevo");
    expect(files).toBe(1);
    expect((await git(["log", "-1", "--format=%s"], repo)).stdout).toBe("feat: nuevo");
    expect((await git(["status", "--porcelain"], repo)).stdout).toBe("M app.ts");
    await expect(commitFiles(repo, ["app.ts"], "  ")).rejects.toThrow("mensaje");
    await expect(commitFiles(repo, ["otro.ts"], "x")).rejects.toThrow("no tiene cambios");
    await expect(commitFiles(repo, ["../fuera.ts"], "x")).rejects.toThrow("Ruta no válida");
  });
});

describe("resolving conflicts without a terminal", () => {
  test("each file settled, the branch gets main, and then integrates cleanly", async () => {
    const s = await startMergeSession(repo, "feat/a", "main");
    expect(s.conflicts.sort()).toEqual(["app.ts", "otro.ts"]);
    const file = await conflictFile(s, "app.ts");
    expect(file).toMatchObject({ branch: "export const a = 2;\n", base: "export const a = 3;\n", resolved: false });
    expect(file.merged).toContain("<<<<<<<");

    await expect(resolveConflict(s, "app.ts", { content: file.merged })).rejects.toThrow("marcas de conflicto");
    await resolveConflict(s, "app.ts", { content: "export const a = 23;\n" });
    await expect(finishMergeSession(s)).rejects.toThrow("Faltan por resolver: otro.ts");
    await resolveConflict(s, "otro.ts", { take: "base" });
    expect((await conflictFile(s, "otro.ts")).resolved).toBe(true);
    await finishMergeSession(s);

    // Nothing touched main's checkout; the branch now has main in it.
    expect(await read("app.ts")).toBe("export const a = 3;\n");
    expect((await git(["show", "feat/a:app.ts"], repo)).stdout).toBe("export const a = 23;");
    expect((await git(["show", "feat/a:otro.ts"], repo)).stdout).toBe("main");
    expect((await git(["worktree", "list"], repo)).stdout.split("\n")).toHaveLength(1);
    const integrated = await integrateBranch(repo, "feat/a", "main");
    expect(integrated.merge).toBe("fast-forward");
    expect(await read("app.ts")).toBe("export const a = 23;\n");
  });

  test("the branch's version, or giving up, leave everything clean", async () => {
    const before = (await git(["rev-parse", "feat/a"], repo)).stdout;
    const s = await startMergeSession(repo, "feat/a", "main");
    await resolveConflict(s, "app.ts", { take: "branch" });
    await discard(s);
    expect((await git(["rev-parse", "feat/a"], repo)).stdout).toBe(before);
    expect((await git(["worktree", "list"], repo)).stdout.split("\n")).toHaveLength(1);
  });

  test("a branch checked out in a worktree moves there too", async () => {
    const wt = join(tmp, "wt");
    await git(["worktree", "add", "-q", wt, "feat/a"], repo);
    const s = await startMergeSession(repo, "feat/a", "main");
    for (const f of s.conflicts) await resolveConflict(s, f, { take: "branch" });
    const { sha } = await finishMergeSession(s);
    expect((await git(["rev-parse", "HEAD"], wt)).stdout).toBe(sha);
    expect((await git(["status", "--porcelain"], wt)).stdout).toBe("");
  });
});
