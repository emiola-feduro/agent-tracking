import { openDb } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";

let tmp: string;
let repo: string;
let app: ReturnType<typeof createApp>;
let projectId: string;
const call = async (method: string, path: string, json?: unknown) => {
  const res = await app.request(`/api${path}`, {
    method,
    headers: json ? { "Content-Type": "application/json" } : {},
    body: json ? JSON.stringify(json) : undefined,
  });
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
};
const run = async (args: string[], cwd = repo) => {
  const r = await git(args, cwd);
  if (!r.ok) throw new Error(r.stderr);
  return r.stdout;
};
const branches = async () => (await call("GET", `/projects/${projectId}/repo/branches`)).data.branches.map((b: any) => b.name).sort();
const del = (name: string, force = false) => call("DELETE", `/projects/${projectId}/repo/branches/${encodeURIComponent(name)}${force ? "?force=1" : ""}`);

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-del-"));
  repo = join(tmp, "repo");
  await run(["init", "-q", "-b", "main", repo], tmp);
  await run(["config", "user.email", "t@t"]);
  await run(["config", "user.name", "t"]);
  await writeFile(join(repo, "a.ts"), "1\n");
  await run(["add", "."]);
  await run(["commit", "-qm", "init"]);
  app = createApp(openDb(":memory:"), { claudeHome: join(tmp, "claude") });
  projectId = (await call("POST", "/projects", { name: "R", kind: "cli", repoPath: repo })).data.project.id;
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

describe("deleting branches", () => {
  test("a merged branch goes; the current one and one open in a worktree do not", async () => {
    await run(["branch", "feat/listo"]);
    expect((await del("feat/listo")).status).toBe(200);
    expect(await branches()).toEqual(["main"]);

    expect((await del("main")).data.error).toContain("rama actual");
    await run(["worktree", "add", "-q", "-b", "feat/en-worktree", join(tmp, "wt")]);
    const busy = await del("feat/en-worktree");
    expect(busy.status).toBe(409);
    expect(busy.data.error).toContain("worktree");
  });

  test("unmerged work is only deleted when forced", async () => {
    await run(["switch", "-q", "-c", "fix/sin-fusionar"]);
    await writeFile(join(repo, "b.ts"), "2\n");
    await run(["add", "."]);
    await run(["commit", "-qm", "b"]);
    await run(["switch", "-q", "main"]);
    const listed = (await call("GET", `/projects/${projectId}/repo/branches`)).data.branches.find((b: any) => b.name === "fix/sin-fusionar");
    expect(listed).toMatchObject({ unmerged: 1, agent: false });
    const refused = await del("fix/sin-fusionar");
    expect(refused).toMatchObject({ status: 409, data: { error: expect.stringContaining("1 commit que no está en main"), ahead: 1 } });
    expect((await del("fix/sin-fusionar", true)).status).toBe(200);
    expect(await branches()).not.toContain("fix/sin-fusionar");
  });

  test("a branch an agent is working on is kept", async () => {
    await run(["switch", "-q", "-c", "feat/agente"]);
    await call("POST", "/agent/hook", { cwd: repo, session_id: "s1", hook_event_name: "UserPromptSubmit", prompt: "trabaja" });
    await run(["switch", "-q", "main"]);
    const listed = (await call("GET", `/projects/${projectId}/repo/branches`)).data.branches.find((b: any) => b.name === "feat/agente");
    expect(listed.agent).toBe(true);
    const refused = await del("feat/agente");
    expect(refused).toMatchObject({ status: 409, data: { code: "agent" } });
    expect(refused.data.error).toContain("Un agente está trabajando");

    // Once the turn ends, it can go.
    await call("POST", "/agent/hook", { cwd: repo, session_id: "s1", hook_event_name: "Stop" });
    await Bun.sleep(200);
    expect((await del("feat/agente")).status).toBe(200);
  });
});
