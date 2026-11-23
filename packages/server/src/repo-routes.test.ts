import { openDb } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, type AppEvent } from "./app";

let tmp: string;
let repo: string;
let projectId: string;
let noRepoId: string;
const events: AppEvent[] = [];
let app: ReturnType<typeof createApp>;

const call = async (method: string, path: string, json?: unknown) => {
  const res = await app.request(`/api${path}`, {
    method,
    headers: json ? { "Content-Type": "application/json" } : {},
    body: json ? JSON.stringify(json) : undefined,
  });
  return { status: res.status, data: (await res.json()) as any };
};

const run = async (...args: string[]) => {
  const r = await git(args, repo);
  if (!r.ok) throw new Error(r.stderr);
};
const commitAll = async (msg: string) => {
  await run("add", "-A");
  await run("-c", "user.name=Ana", "-c", "user.email=ana@example.com", "commit", "-q", "-m", msg);
};

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-repo-routes-"));
  repo = join(tmp, "app");
  await git(["init", "-q", "-b", "main", repo]);
  await mkdir(join(repo, "src"));
  await writeFile(join(repo, "src", "sum.ts"), "export function sum(a: number, b: number) {\n  return a + b;\n}\n");
  await writeFile(
    join(repo, "src", "sum.test.ts"),
    'import { expect, test } from "bun:test";\nimport { sum } from "./sum";\n\ntest("sums", () => {\n  expect(sum(1, 2)).toBe(3);\n});\n',
  );
  app = createApp(openDb(":memory:"), { emit: (e) => events.push(e), claudeHome: join(tmp, "claude") });
  const created = await call("POST", "/projects", { name: "App", platforms: ["web"], repoPath: repo });
  projectId = created.data.project.id;
  noRepoId = (await call("POST", "/projects", { name: "Sin repo", platforms: ["web"] })).data.project.id;
  // Creating the project writes its shareable files into the repo: commit everything.
  await commitAll("first");
  await run("branch", "feature/login");
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

test("branches", async () => {
  const { status, data } = await call("GET", `/projects/${projectId}/repo/branches`);
  expect(status).toBe(200);
  expect(data.current).toBe("main");
  expect(data.branches.map((b: { name: string }) => b.name).sort()).toEqual(["feature/login", "main"]);
});

test("projects without a local repository get a clear error", async () => {
  const { status, data } = await call("GET", `/projects/${noRepoId}/repo/branches`);
  expect(status).toBe(400);
  expect(data.error).toBe("El proyecto no tiene repositorio local");
  expect((await call("GET", "/projects/nope/repo/branches")).status).toBe(404);
});

test("commits and changes", async () => {
  const { data } = await call("GET", `/projects/${projectId}/repo/commits?limit=5`);
  expect(data.commits).toHaveLength(1);
  expect(data.commits[0]).toMatchObject({ subject: "first", author: { name: "Ana" } });
  expect(data.commits[0].files.map((f: { path: string }) => f.path)).toContain("src/sum.ts");
  expect((await call("GET", `/projects/${projectId}/repo/commits?ref=--all`)).status).toBe(400);

  await writeFile(join(repo, "src", "sum.ts"), "export function sum(a: number, b: number) {\n  return b + a;\n}\n");
  const changes = await call("GET", `/projects/${projectId}/repo/changes`);
  expect(changes.data.files).toEqual([{ path: "src/sum.ts", status: "modified", staged: false, unstaged: true }]);
});

test("checkout refuses with uncommitted changes (409) and switches when clean", async () => {
  const refused = await call("POST", `/projects/${projectId}/repo/checkout`, { branch: "feature/login" });
  expect(refused.status).toBe(409);
  expect(refused.data.error).toContain("cambios sin commit");
  expect(refused.data).toMatchObject({ code: "dirty", files: ["src/sum.ts"] });

  await run("checkout", "--", "src/sum.ts");
  const ok = await call("POST", `/projects/${projectId}/repo/checkout`, { branch: "feature/login" });
  expect(ok).toEqual({ status: 200, data: { branch: "feature/login", previous: "main" } });
  expect(events.at(-1)).toEqual({ type: "changed", projectId, entity: "repo" });
  expect((await call("POST", `/projects/${projectId}/repo/checkout`, { branch: "nope" })).status).toBe(404);
  expect((await call("POST", `/projects/${projectId}/repo/checkout`, {})).status).toBe(400);
  await call("POST", `/projects/${projectId}/repo/checkout`, { branch: "main" });
});

test("file analysis", async () => {
  const { status, data } = await call("GET", `/projects/${projectId}/repo/analysis/file?path=src/sum.ts`);
  expect(status).toBe(200);
  expect(data.symbols).toEqual([{ name: "sum", kind: "function", startLine: 1, endLine: 3, exported: true }]);
  expect((await call("GET", `/projects/${projectId}/repo/analysis/file?path=../x.ts`)).status).toBe(400);
  expect((await call("GET", `/projects/${projectId}/repo/analysis/file?path=src/none.ts`)).status).toBe(404);
  expect((await call("GET", `/projects/${projectId}/repo/analysis/file?path=README.md`)).status).toBe(415);
});

test("repository analysis is incremental", async () => {
  const first = await call("GET", `/projects/${projectId}/repo/analysis`);
  expect(first.status).toBe(200);
  expect(first.data.files.map((f: { path: string }) => f.path)).toEqual(["src/sum.test.ts", "src/sum.ts"]);
  expect(first.data.stats.testsByKind.unit).toBe(1);
  expect(first.data.files[0].tests[0]).toMatchObject({ name: "sums", framework: "bun", kind: "unit", line: 4 });
  const second = await call("GET", `/projects/${projectId}/repo/analysis`);
  expect(second.data.stats).toMatchObject({ parsed: 0, fromCache: 2 });
});
