import { createCollabServer, openCollabStore, type CollabStore } from "@agent-tracking/collab";
import { openDb } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";

/**
 * Three machines (three apps, each with its own database and repo clone) sync one project through a
 * shared server running in process: Ana owns it, Beto edits, Carla only reads.
 */
let tmp: string;
let store: CollabStore;
let shared: ReturnType<typeof createCollabServer>;
const collabFetch = ((input: RequestInfo | URL, init?: RequestInit) => shared.fetch(new Request(input, init))) as typeof fetch;
const URL_ = "http://collab.test";

type App = ReturnType<typeof createApp>;
let ana: App;
let beto: App;
let carla: App;
let repos: Record<"ana" | "beto" | "carla", string>;
let projectId: string;

const call = async (app: App, method: string, path: string, json?: unknown) => {
  const res = await app.request(`/api${path}`, {
    method,
    headers: json ? { "Content-Type": "application/json" } : {},
    body: json ? JSON.stringify(json) : undefined,
  });
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
};
const newRepo = async (name: string) => {
  const dir = join(tmp, name);
  const r = await git(["init", "-q", "-b", "main", dir], tmp);
  if (!r.ok) throw new Error(r.stderr);
  return dir;
};
const rules = async (app: App) => ((await call(app, "GET", `/projects/${projectId}`)).data.rules as { text: string }[]).map((r) => r.text).sort();

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-collab-"));
  repos = { ana: await newRepo("ana"), beto: await newRepo("beto"), carla: await newRepo("carla") };
  store = await openCollabStore(":memory:");
  shared = createCollabServer(store);
  const opts = { claudeHome: join(tmp, "claude"), collabFetch };
  ana = createApp(openDb(":memory:"), opts);
  beto = createApp(openDb(":memory:"), opts);
  carla = createApp(openDb(":memory:"), opts);
});
afterAll(async () => {
  store.close();
  await rm(tmp, { recursive: true, force: true });
});

describe("the desktop app syncs with a shared server", () => {
  test("without a connection the project is not shared and sync asks to connect", async () => {
    const created = await call(ana, "POST", "/projects", { name: "Tienda", kind: "api", repoPath: repos.ana, rules: ["Precios con IVA"] });
    projectId = created.data.project.id;
    expect((await call(ana, "GET", `/projects/${projectId}/collab`)).data).toMatchObject({ connected: false, shared: false });
    expect((await call(ana, "POST", `/projects/${projectId}/collab/sync`)).status).toBe(401);
  });

  test("each person connects with their account; the token stays on the server", async () => {
    const a = await call(ana, "POST", "/collab/connect", { url: URL_, email: "ana@equipo.test", name: "Ana", password: "secreto-ana" });
    expect(a.status).toBe(200);
    expect(JSON.stringify(a.data)).not.toContain("token");
    await call(beto, "POST", "/collab/connect", { url: URL_, email: "beto@equipo.test", name: "Beto", password: "secreto-beto" });
    await call(carla, "POST", "/collab/connect", { url: URL_, email: "carla@equipo.test", name: "Carla", password: "secreto-carla" });
    const status = await call(ana, "GET", "/collab");
    expect(status.data).toEqual({ connected: true, url: URL_, user: expect.objectContaining({ name: "Ana" }) });
    expect(JSON.stringify(status.data)).not.toContain("token");
    expect((await call(ana, "POST", "/collab/connect", { url: URL_, email: "ana@equipo.test", password: "mala-clave" })).status).toBe(401);
  });

  test("the owner shares the project and gives roles", async () => {
    const shared = await call(ana, "POST", `/projects/${projectId}/collab/share`);
    expect(shared.data).toMatchObject({ revision: 1, role: "owner", pushed: true });
    expect((await call(ana, "PUT", `/projects/${projectId}/collab/members`, { email: "beto@equipo.test", role: "editor" })).status).toBe(200);
    expect((await call(ana, "PUT", `/projects/${projectId}/collab/members`, { email: "carla@equipo.test", role: "viewer" })).status).toBe(200);
    const members = (await call(ana, "GET", `/projects/${projectId}/collab/members`)).data.members.map((m: any) => [m.name, m.role]);
    expect(members).toEqual([
      ["Ana", "owner"],
      ["Beto", "editor"],
      ["Carla", "viewer"],
    ]);
    // Only the owner manages members.
    expect((await call(beto, "PUT", `/projects/${projectId}/collab/members`, { email: "carla@equipo.test", role: "owner" })).status).toBe(403);
  });

  test("the others see it shared with them and bring it to their machine", async () => {
    const list = (await call(beto, "GET", "/collab/projects")).data.projects;
    expect(list.map((p: any) => [p.name, p.role])).toEqual([["Tienda", "editor"]]);
    const joined = await call(beto, "POST", "/collab/join", { projectId, repoPath: repos.beto });
    expect(joined.data).toMatchObject({ role: "editor", pulled: true });
    expect(await rules(beto)).toEqual(["Precios con IVA"]);
    expect((await call(carla, "POST", "/collab/join", { projectId, repoPath: repos.carla })).status).toBe(200);
    expect(await rules(carla)).toEqual(["Precios con IVA"]);
  });

  test("changes made at the same time on two machines are merged", async () => {
    await call(beto, "POST", `/projects/${projectId}/rules`, { text: "Stock nunca negativo" });
    await call(ana, "POST", `/projects/${projectId}/rules`, { text: "Envíos gratis desde 50" });
    expect((await call(beto, "POST", `/projects/${projectId}/collab/sync`)).data).toMatchObject({ pushed: true, revision: 2 });
    const synced = await call(ana, "POST", `/projects/${projectId}/collab/sync`);
    expect(synced.data).toMatchObject({ pulled: true, pushed: true, revision: 3 });
    expect(await rules(ana)).toEqual(["Envíos gratis desde 50", "Precios con IVA", "Stock nunca negativo"]);
    expect((await call(beto, "POST", `/projects/${projectId}/collab/sync`)).data).toMatchObject({ pulled: true, pushed: false });
    expect(await rules(beto)).toEqual(await rules(ana));
    const status = (await call(beto, "GET", `/projects/${projectId}/collab`)).data;
    expect(status).toMatchObject({ shared: true, role: "editor", revision: 3, syncedRevision: 3 });
  });

  test("a viewer receives changes but never pushes its own", async () => {
    await call(carla, "POST", `/projects/${projectId}/rules`, { text: "Regla local de Carla" });
    const synced = await call(carla, "POST", `/projects/${projectId}/collab/sync`);
    expect(synced.data).toMatchObject({ role: "viewer", pushed: false, revision: 3 });
    expect(await rules(carla)).toContain("Stock nunca negativo");
    await call(ana, "POST", `/projects/${projectId}/collab/sync`);
    expect(await rules(ana)).not.toContain("Regla local de Carla");
  });

  test("presence shows who is working on the project", async () => {
    await call(beto, "POST", `/projects/${projectId}/collab/presence`, { activity: "RF2" });
    const { data } = await call(ana, "POST", `/projects/${projectId}/collab/presence`, { activity: "" });
    expect(data.presence.map((p: any) => p.name)).toEqual(["Ana", "Beto"]);
  });

  test("signing out forgets the connection", async () => {
    expect((await call(carla, "DELETE", "/collab")).status).toBe(204);
    expect((await call(carla, "GET", "/collab")).data.connected).toBe(false);
    expect((await call(carla, "GET", "/collab/projects")).status).toBe(401);
  });
});
