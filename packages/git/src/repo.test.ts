import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  changedFilesBetween,
  checkoutBranch,
  commitLog,
  currentBranch,
  git,
  GitError,
  gitIgnored,
  listBranches,
  listRepoFiles,
  resolveRepoPath,
  watchRepo,
  workingTreeChanges,
} from "./index";

let tmp: string;
let repo: string;
const run = async (...args: string[]) => {
  const r = await git(args, repo);
  if (!r.ok) throw new Error(r.stderr);
  return r.stdout;
};
const commit = async (msg: string, author = "Ana <ana@example.com>") => {
  await run("add", "-A");
  await run("-c", "user.name=Test", "-c", "user.email=t@example.com", "commit", "-q", "-m", msg, `--author=${author}`);
};

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-git-repo-"));
  repo = join(tmp, "repo");
  await git(["init", "-q", "-b", "main", repo]);
  await writeFile(join(repo, ".gitignore"), "dist/\n*.log\n");
  await writeFile(join(repo, "a.ts"), "export const a = 1;\n");
  await commit("first");
  await mkdir(join(repo, "src"));
  await writeFile(join(repo, "src", "b.ts"), "export const b = 2;\n");
  await writeFile(join(repo, "a.ts"), "export const a = 10;\n");
  await commit("second\n\nbody line", "Luis <luis@example.com>");
  await run("branch", "feature/x");
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

test("lists branches with the current one first", async () => {
  const branches = await listBranches(repo);
  expect(branches.map((b) => b.name).sort()).toEqual(["feature/x", "main"]);
  expect(branches[0]).toMatchObject({ name: "main", current: true, subject: "second" });
  expect(await currentBranch(repo)).toBe("main");
});

test("commit log includes author, date and changed files", async () => {
  const log = await commitLog(repo);
  expect(log).toHaveLength(2);
  expect(log[0]).toMatchObject({ subject: "second", body: "body line", author: { name: "Luis", email: "luis@example.com" } });
  expect(log[0]!.files).toEqual([
    { path: "a.ts", status: "modified" },
    { path: "src/b.ts", status: "added" },
  ]);
  expect(new Date(log[0]!.date).getTime()).not.toBeNaN();
  expect(log[1]!.files.map((f) => f.path).sort()).toEqual([".gitignore", "a.ts"]);
  expect(await commitLog(repo, { limit: 1, skip: 1 })).toHaveLength(1);
  expect((await commitLog(repo, { path: "src/b.ts" })).map((c) => c.subject)).toEqual(["second"]);
});

test("refs are validated", async () => {
  expect(commitLog(repo, { ref: "--all" })).rejects.toThrow("Referencia inválida");
  expect(commitLog(repo, { ref: "nope" })).rejects.toThrow("No existe la referencia");
  expect(commitLog(repo, { path: "../outside" })).rejects.toThrow("dentro del repositorio");
});

test("changed files between refs", async () => {
  const files = await changedFilesBetween(repo, "HEAD~1", "HEAD");
  expect(files).toEqual([
    { path: "a.ts", status: "modified" },
    { path: "src/b.ts", status: "added" },
  ]);
});

test("working tree changes and checkout refusal when dirty", async () => {
  expect(await workingTreeChanges(repo)).toEqual([]);
  await writeFile(join(repo, "a.ts"), "export const a = 11;\n");
  await writeFile(join(repo, "new.ts"), "x");
  await writeFile(join(repo, "debug.log"), "ignored");
  const changes = await workingTreeChanges(repo);
  expect(changes).toEqual([
    { path: "a.ts", status: "modified", staged: false, unstaged: true },
    { path: "new.ts", status: "untracked", staged: false, unstaged: true },
  ]);

  const err = await checkoutBranch(repo, "feature/x").catch((e) => e);
  expect(err).toBeInstanceOf(GitError);
  expect(err.code).toBe("dirty");
  expect(err.message).toContain("cambios sin commit");
  expect(err.message).toContain("a.ts");
  expect(await currentBranch(repo)).toBe("main");

  await run("checkout", "--", "a.ts");
  await unlink(join(repo, "new.ts"));
  await unlink(join(repo, "debug.log"));
});

test("checkout switches to existing branches only", async () => {
  expect(checkoutBranch(repo, "missing")).rejects.toThrow("no existe");
  expect(checkoutBranch(repo, "-f")).rejects.toThrow("inválido");
  expect(checkoutBranch(repo, "a..b")).rejects.toThrow("inválido");
  expect(await checkoutBranch(repo, "feature/x")).toEqual({ branch: "feature/x", previous: "main" });
  expect(await currentBranch(repo)).toBe("feature/x");
  await checkoutBranch(repo, "main");
});

test("path resolution stays inside the repo", async () => {
  expect(await resolveRepoPath(repo, "src/b.ts")).toEqual({ absolute: join(repo, "src", "b.ts"), relative: "src/b.ts" });
  expect(await resolveRepoPath(repo, join(repo, "a.ts"))).toMatchObject({ relative: "a.ts" });
  expect(resolveRepoPath(repo, "../x")).rejects.toThrow("dentro del repositorio");
  expect(resolveRepoPath(repo, "/etc/passwd")).rejects.toThrow("dentro del repositorio");
  expect(resolveRepoPath("relative", "a.ts")).rejects.toThrow("absoluta");
  await symlink("/etc", join(repo, "escape"));
  expect(resolveRepoPath(repo, "escape/passwd")).rejects.toThrow("dentro del repositorio");
  await unlink(join(repo, "escape"));
});

test("listRepoFiles and gitIgnored honor .gitignore", async () => {
  await writeFile(join(repo, "x.log"), "");
  expect(await listRepoFiles(repo)).toEqual([".gitignore", "a.ts", "src/b.ts"]);
  expect([...(await gitIgnored(repo, ["x.log", "a.ts", "dist/out.js"]))].sort()).toEqual(["dist/out.js", "x.log"]);
  await unlink(join(repo, "x.log"));
});

test("watcher debounces and ignores .git, node_modules and gitignored files", async () => {
  const batches: string[][] = [];
  const w = watchRepo(repo, (paths) => batches.push(paths), { debounceMs: 150 });
  try {
    await Bun.sleep(50);
    await mkdir(join(repo, "node_modules"), { recursive: true });
    await mkdir(join(repo, "dist"), { recursive: true });
    await writeFile(join(repo, "node_modules", "m.js"), "x");
    await writeFile(join(repo, "dist", "out.js"), "x");
    await writeFile(join(repo, "app.log"), "x");
    await writeFile(join(repo, "src", "c.ts"), "1");
    await writeFile(join(repo, "src", "c.ts"), "2");
    await writeFile(join(repo, "a.ts"), "export const a = 12;\n");
    for (let i = 0; i < 40 && batches.length === 0; i++) await Bun.sleep(50);
    await Bun.sleep(300);
  } finally {
    w.close();
  }
  expect(batches).toHaveLength(1);
  const paths = batches[0]!.filter((p) => p !== "dist"); // some platforms report the created dir itself
  expect(paths).toEqual(["a.ts", "src/c.ts"]);
  await run("checkout", "--", "a.ts");
});
