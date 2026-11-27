import { openDb } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";

let tmp: string;
let repo: string;
beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-integrate-route-"));
  repo = join(tmp, "repo");
  await git(["init", "-q", "-b", "main", repo]);
  await git(["config", "user.email", "t@t"], repo);
  await git(["config", "user.name", "t"], repo);
  await writeFile(join(repo, "app.ts"), "export const a = 1;\n");
  await git(["add", "."], repo);
  await git(["commit", "-qm", "init"], repo);
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

test("a branch is integrated into main from the app; problems come back as readable errors", async () => {
  const app = createApp(openDb(":memory:"));
  const call = async (method: string, path: string, json?: unknown) => {
    const res = await app.request(`/api${path}`, { method, headers: json ? { "Content-Type": "application/json" } : {}, body: json ? JSON.stringify(json) : undefined });
    return { status: res.status, data: (await res.json().catch(() => null)) as any };
  };
  const id = (await call("POST", "/projects", { name: "Tienda", kind: "api", repoPath: repo })).data.project.id;
  // Creating the project wrote .agent-tracking into the checkout: it is committed on the way.
  await git(["switch", "-q", "-c", "feat/pagos"], repo);
  await writeFile(join(repo, "pagos.ts"), "export const pagar = () => 0;\n");
  await git(["add", "pagos.ts"], repo);
  await git(["commit", "-qm", "pagos"], repo);

  const done = await call("POST", `/projects/${id}/repo/integrate`, { branch: "feat/pagos" });
  expect(done.status).toBe(200);
  expect(done.data).toMatchObject({ base: "main", pushed: false, switchedBack: true });
  expect(done.data.pushError).toContain("no tiene el remoto origin");
  expect((await git(["branch", "--show-current"], repo)).stdout).toBe("main");
  expect(await Bun.file(join(repo, "pagos.ts")).exists()).toBe(true);

  expect((await call("POST", `/projects/${id}/repo/integrate`, { branch: "no-existe" })).status).toBe(404);
  expect((await call("POST", `/projects/${id}/repo/integrate`, { branch: "main" })).status).toBe(400);

  await git(["switch", "-q", "-c", "feat/choque"], repo);
  await writeFile(join(repo, "app.ts"), "export const a = 2;\n");
  await git(["commit", "-qam", "choque"], repo);
  await git(["switch", "-q", "main"], repo);
  await writeFile(join(repo, "app.ts"), "export const a = 3;\n");
  await git(["commit", "-qam", "main cambia"], repo);
  const conflict = await call("POST", `/projects/${id}/repo/integrate`, { branch: "feat/choque", push: false });
  expect(conflict.status).toBe(409);
  expect(conflict.data.error).toContain("app.ts");
  expect(conflict.data.conflicts).toEqual(["app.ts"]);
});

test("commits and conflicts are settled from the app, then the branch integrates", async () => {
  const repo3 = join(tmp, "repo3");
  await git(["init", "-q", "-b", "main", repo3]);
  await git(["config", "user.email", "t@t"], repo3);
  await git(["config", "user.name", "t"], repo3);
  await writeFile(join(repo3, "app.ts"), "export const a = 1;\n");
  await git(["add", "."], repo3);
  await git(["commit", "-qm", "init"], repo3);
  const spawned: string[][] = [];
  const app = createApp(openDb(":memory:"), {
    agentRuns: {
      which: () => "/bin/claude",
      spawn: (argv) => (spawned.push(argv), { stdout: new ReadableStream({ start: (c) => c.close() }), stderr: new ReadableStream({ start: (c) => c.close() }), exited: new Promise<number>(() => {}), kill: () => {} }),
    },
  });
  const call = async (method: string, path: string, json?: unknown) => {
    const res = await app.request(`/api${path}`, {
      method,
      headers: { origin: "http://127.0.0.1:4317", ...(json ? { "Content-Type": "application/json" } : {}) },
      body: json ? JSON.stringify(json) : undefined,
    });
    return { status: res.status, data: (await res.json().catch(() => null)) as any };
  };
  const id = (await call("POST", "/projects", { name: "Tienda", kind: "api", repoPath: repo3 })).data.project.id;

  // Uncommitted work blocks integrating; it is committed from the app.
  const changes = (await call("GET", `/projects/${id}/repo/changes`)).data.files.map((f: any) => f.path);
  expect(changes.some((p: string) => p.startsWith(".agent-tracking/"))).toBe(true);
  expect((await call("POST", `/projects/${id}/repo/commit`, { message: "chore: datos", paths: changes })).status).toBe(200);
  expect((await call("GET", `/projects/${id}/repo/changes`)).data.files).toEqual([]);

  await git(["switch", "-q", "-c", "feat/x"], repo3);
  await writeFile(join(repo3, "app.ts"), "export const a = 2;\n");
  await git(["commit", "-qam", "rama"], repo3);
  await git(["switch", "-q", "main"], repo3);
  await writeFile(join(repo3, "app.ts"), "export const a = 3;\n");
  await git(["commit", "-qam", "main"], repo3);
  expect((await call("POST", `/projects/${id}/repo/integrate`, { branch: "feat/x", push: false })).status).toBe(409);

  // An agent can be asked to resolve them...
  const run = await call("POST", `/projects/${id}/runs/resolve`, { branch: "feat/x", agent: "claude-code", conflicts: ["app.ts"] });
  expect(run.status).toBe(201);
  expect(spawned[0]!.at(-1)).toContain("git merge main");
  expect(spawned[0]!.at(-1)).toContain("Archivos en conflicto: app.ts");

  // ...or they are resolved here, file by file.
  const m = (await call("POST", `/projects/${id}/repo/merges`, { branch: "feat/x" })).data;
  expect(m).toMatchObject({ branch: "feat/x", base: "main", conflicts: ["app.ts"], pending: ["app.ts"] });
  const file = (await call("GET", `/projects/${id}/repo/merges/${m.id}/file?path=app.ts`)).data;
  expect(file).toMatchObject({ branch: "export const a = 2;\n", base: "export const a = 3;\n" });
  expect((await call("POST", `/projects/${id}/repo/merges/${m.id}/resolve`, { path: "app.ts" })).status).toBe(400);
  expect((await call("POST", `/projects/${id}/repo/merges/${m.id}/resolve`, { path: "app.ts", content: "export const a = 23;\n" })).data.pending).toEqual([]);
  expect((await call("POST", `/projects/${id}/repo/merges/${m.id}/finish`)).status).toBe(200);
  expect((await call("POST", `/projects/${id}/repo/merges/${m.id}/finish`)).status).toBe(404);

  const done = await call("POST", `/projects/${id}/repo/integrate`, { branch: "feat/x", push: false });
  expect(done.data.merge).toBe("fast-forward");
  expect(await Bun.file(join(repo3, "app.ts")).text()).toBe("export const a = 23;\n");
});
