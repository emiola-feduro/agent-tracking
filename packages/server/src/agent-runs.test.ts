import { openDb } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { createTracker } from "@agent-tracking/tracking";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProcess } from "./agent-run-routes";
import { createApp } from "./app";

let tmp: string;
let repo: string;
beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-runs-"));
  repo = join(tmp, "repo");
  await git(["init", "-q", "-b", "main", repo]);
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

/** A fake agent: prints what it is told, then waits until it is killed or `finish` is called. */
const fakeAgent = () => {
  const spawned: { argv: string[]; cwd: string }[] = [];
  let finish: (code: number) => void = () => {};
  const spawn = (argv: string[], cwd: string): AgentProcess => {
    let out!: ReadableStreamDefaultController<Uint8Array>;
    spawned.push({ argv, cwd });
    const exited = new Promise<number>((r) => (finish = (code) => (out.close(), r(code))));
    const stdout = new ReadableStream<Uint8Array>({ start: (c) => void ((out = c), c.enqueue(new TextEncoder().encode("Leyendo el contexto\nCreando la rama feat/pagos\n"))) });
    const stderr = new ReadableStream<Uint8Array>({ start: (c) => c.close() });
    return { stdout, stderr, exited, kill: () => finish(143) };
  };
  return { spawn, spawned, finish: (code: number) => finish(code) };
};

test("an agent is started on a requirement from the app, its output is kept and it can be stopped", async () => {
  const agent = fakeAgent();
  const app = createApp(openDb(":memory:"), { tracker: undefined, agentRuns: { spawn: agent.spawn, which: (bin) => (bin === "claude" ? "/bin/claude" : null) } });
  const call = async (method: string, path: string, json?: unknown, origin: string | null = "http://127.0.0.1:4317") => {
    const headers: Record<string, string> = json ? { "Content-Type": "application/json" } : {};
    if (origin) headers.origin = origin;
    const res = await app.request(`/api${path}`, { method, headers, body: json ? JSON.stringify(json) : undefined });
    return { status: res.status, data: (await res.json().catch(() => null)) as any };
  };
  const created = await call("POST", "/projects", { name: "Tienda", kind: "api", repoPath: repo, requirements: [{ title: "Pagos", type: "functional" }] });
  const id = created.data.project.id;

  // Other pages, missing origins, folders outside the project and agents not installed are refused.
  expect((await call("POST", `/projects/${id}/runs`, { items: [{ requirementId: "RF1" }], agent: "claude-code" }, "https://evil.example")).status).toBe(403);
  expect((await call("POST", `/projects/${id}/runs`, { items: [{ requirementId: "RF1" }], agent: "claude-code" }, null)).status).toBe(403);
  expect((await call("POST", `/projects/${id}/runs`, { items: [{ requirementId: "RF1" }], agent: "claude-code", cwd: tmp })).status).toBe(400);
  expect((await call("POST", `/projects/${id}/runs`, { items: [{ requirementId: "RF1" }], agent: "codex" })).status).toBe(409);
  expect(agent.spawned).toHaveLength(0);

  const started = await call("POST", `/projects/${id}/runs`, { items: [{ requirementId: "RF1" }], agent: "claude-code", instructions: "Sin dependencias nuevas" });
  expect(started.status).toBe(201);
  expect(started.data).toMatchObject({ status: "running", label: "RF1", agent: "claude-code", permission: "safe" });
  expect(agent.spawned[0]!.cwd).toBe(repo);
  expect(agent.spawned[0]!.argv.slice(0, 4)).toEqual(["claude", "-p", "--permission-mode", "auto"]);
  expect(agent.spawned[0]!.argv.at(-1)).toContain("Sin dependencias nuevas");
  // One agent per checkout at a time: the next one waits in the queue.
  const queued = await call("POST", `/projects/${id}/runs`, { items: [{ requirementId: "RF1" }], agent: "claude-code" });
  expect(queued.data.status).toBe("queued");
  expect(agent.spawned).toHaveLength(1);
  expect((await call("POST", `/projects/${id}/runs/${queued.data.id}/stop`)).data.status).toBe("stopped");

  await Bun.sleep(10);
  const listed = (await call("GET", `/projects/${id}/runs`)).data;
  expect(listed.find((r: any) => r.id === started.data.id).output).toEqual(["Leyendo el contexto", "Creando la rama feat/pagos"]);

  const stopped = await call("POST", `/projects/${id}/runs/${started.data.id}/stop`);
  expect(stopped.data.status).toBe("stopped");
  await Bun.sleep(10);
  const after = (await call("GET", `/projects/${id}/runs`)).data.find((r: any) => r.id === started.data.id);
  expect(after).toMatchObject({ status: "stopped", exitCode: 143 });
  expect(after.endedAt).not.toBeNull();
});

test("several requirements and criteria go to one agent; only what is not done can be queued", async () => {
  const agent = fakeAgent();
  const app = createApp(openDb(":memory:"), { agentRuns: { spawn: agent.spawn, which: () => "/bin/agent" } });
  const call = async (method: string, path: string, json?: unknown) => {
    const res = await app.request(`/api${path}`, {
      method,
      headers: { origin: "http://localhost:5173", ...(json ? { "Content-Type": "application/json" } : {}) },
      body: json ? JSON.stringify(json) : undefined,
    });
    return { status: res.status, data: (await res.json().catch(() => null)) as any };
  };
  const created = await call("POST", "/projects", {
    name: "Tienda",
    kind: "api",
    repoPath: repo,
    requirements: [
      { title: "Pagos", type: "functional", dod: [{ criterion: "Cobra con Visa" }, { criterion: "Emite factura" }] },
      { title: "Login", type: "functional", dod: [{ criterion: "Bloquea tras 5 intentos" }] },
    ],
  });
  const id = created.data.project.id;
  const view = (await call("GET", `/projects/${id}`)).data;
  const rf1 = view.requirements.find((r: any) => r.code === "RF1");
  const [visa, factura] = view.dod.filter((d: any) => d.requirementId === rf1.id);
  await call("PATCH", `/projects/${id}/requirements/${rf1.id}/dod/${visa.id}`, { status: "done" });

  // RF1 has a criterion done: not as a whole, and not that criterion.
  expect((await call("POST", `/projects/${id}/runs`, { items: [{ requirementId: "RF1" }], agent: "codex" })).status).toBe(409);
  expect((await call("POST", `/projects/${id}/runs`, { items: [{ requirementId: "RF1", dodIds: [visa.id] }], agent: "codex" })).status).toBe(409);

  const run = await call("POST", `/projects/${id}/runs`, { items: [{ requirementId: "RF2" }, { requirementId: "RF1", dodIds: [factura.id] }], agent: "codex" });
  expect(run.status).toBe(201);
  expect(run.data.label).toBe("RF2 y 1 criterio de RF1");
  expect(run.data.tasks.map((t: any) => [t.code, t.criteria])).toEqual([["RF2", null], ["RF1", 1]]);
  const prompt = agent.spawned[0]!.argv.at(-1)!;
  expect(prompt.indexOf("1. El requerimiento RF2")).toBeLessThan(prompt.indexOf("2. Del requerimiento RF1"));
  expect(prompt).toContain(`Emite factura (id ${factura.id})`);
  expect(prompt).not.toContain("Cobra con Visa");

  // When it ends, the next run queued in the same checkout starts.
  const next = await call("POST", `/projects/${id}/runs`, { items: [{ requirementId: "RF2" }], agent: "codex" });
  expect(next.data.status).toBe("queued");
  agent.finish(0);
  await Bun.sleep(20);
  const runs = (await call("GET", `/projects/${id}/runs`)).data;
  expect(runs.find((r: any) => r.id === run.data.id).status).toBe("done");
  expect(runs.find((r: any) => r.id === next.data.id).status).toBe("running");
  expect(agent.spawned).toHaveLength(2);
  agent.finish(0);
});
