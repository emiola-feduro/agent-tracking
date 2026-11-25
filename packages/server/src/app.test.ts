import { openDb } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, type AppEvent } from "./app";

let tmp: string;
let repo: string;
const events: AppEvent[] = [];

const client = (app: ReturnType<typeof createApp>) => async (method: string, path: string, json?: unknown) => {
  const res = await app.request(`/api${path}`, {
    method,
    headers: json ? { "Content-Type": "application/json" } : {},
    body: json ? JSON.stringify(json) : undefined,
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {}
  return { status: res.status, data };
};

let call: ReturnType<typeof client>;

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-server-"));
  repo = join(tmp, "tienda");
  await git(["init", "-q", "-b", "main", repo]);
  await git(["remote", "add", "origin", "git@github.com:acme/tienda.git"], repo);
  call = client(createApp(openDb(":memory:"), { emit: (e) => events.push(e), claudeHome: join(tmp, "claude") }));
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

const wizardPayload = (repoPath: string | null) => ({
  name: "Tienda",
  goal: "Vender en línea",
  platforms: ["web", "mobile"],
  stack: ["React"],
  databases: ["PostgreSQL", "Redis"],
  repoPath,
  rules: ["Todo pedido requiere login"],
  skills: [{ name: "tdd", description: "Test first", source: "user", location: "/x/SKILL.md" }],
  requirements: [{ title: "Checkout", dod: [{ criterion: "Paga con tarjeta" }, { criterion: "Envía email" }] }],
});

describe("project lifecycle", () => {
  let projectId: string;
  let reqId: string;

  test("creates a project and writes the shareable files into the repo", async () => {
    const { status, data } = await call("POST", "/projects", wizardPayload(join(repo, ".")));
    expect(status).toBe(201);
    expect(data.project.platforms).toEqual(["web", "mobile"]);
    expect(data.project.databases).toEqual(["PostgreSQL", "Redis"]);
    expect(data.project.repoPath).toBe(repo);
    expect(data.project.repoUrl).toBe("https://github.com/acme/tienda");
    projectId = data.project.id;
    reqId = data.requirements[0].id;
    const file = JSON.parse(await readFile(join(repo, ".agent-tracking", "project.json"), "utf8"));
    expect(file.project.id).toBe(projectId);
    expect(file.version).toBe(2);
    const requirement = JSON.parse(await readFile(join(repo, ".agent-tracking", "requirements", `${reqId}.json`), "utf8"));
    expect(requirement.dod).toHaveLength(2);
    expect(await readFile(join(repo, ".agent-tracking", ".gitattributes"), "utf8")).toContain("merge=agent-tracking");
    expect(await readFile(join(repo, ".agent-tracking", "CONTEXT.md"), "utf8")).toContain("# Tienda");
  });

  test("rejects invalid payloads, missing platforms and non-git paths", async () => {
    expect((await call("POST", "/projects", { name: "" })).status).toBe(400);
    expect((await call("POST", "/projects", { ...wizardPayload(null), platforms: [] })).status).toBe(400);
    expect((await call("POST", "/projects", wizardPayload(tmp))).status).toBe(400);
  });

  test("the same repo cannot be added twice", async () => {
    const { status, data } = await call("POST", "/projects", wizardPayload(repo));
    expect(status).toBe(409);
    expect(data.projectId).toBe(projectId);
  });

  test("changes update progress and the repo file", async () => {
    const snap = (await call("GET", `/projects/${projectId}`)).data;
    const dodId = snap.dod[0].id;
    expect((await call("PATCH", `/projects/${projectId}/requirements/${reqId}/dod/${dodId}`, { status: "done" })).status).toBe(200);
    const after = (await call("GET", `/projects/${projectId}`)).data;
    expect(after.progress.project).toBe(50);
    const requirement = JSON.parse(await readFile(join(repo, ".agent-tracking", "requirements", `${reqId}.json`), "utf8"));
    expect(requirement.dod.map((d: any) => d.status)).toContain("done");
    expect(events.at(-1)).toMatchObject({ type: "changed", projectId, entity: "dod" });
  });

  test("cannot edit a requirement through another project", async () => {
    const other = (await call("POST", "/projects", { name: "Otro", platforms: ["desktop"] })).data.project.id;
    expect((await call("PATCH", `/projects/${other}/requirements/${reqId}`, { title: "hack" })).status).toBe(404);
  });

  test("rules CRUD", async () => {
    const created = (await call("POST", `/projects/${projectId}/rules`, { text: "Precios con IVA", priority: 2 })).data;
    const updated = await call("PATCH", `/projects/${projectId}/rules/${created.id}`, { text: "Precios con IVA 15%" });
    expect(updated.data.text).toBe("Precios con IVA 15%");
    expect((await call("DELETE", `/projects/${projectId}/rules/${created.id}`)).status).toBe(204);
  });

  test("context.md", async () => {
    const md = (await call("GET", `/projects/${projectId}/context.md`)).data as string;
    expect(md).toContain("- [x] Paga con tarjeta");
    expect(md).toContain("Web, Móvil");
  });

  test("a collaborator imports the repo and gets the same project", async () => {
    // Simulates a teammate's machine: a fresh database pointing at the same repo.
    const teammate = client(createApp(openDb(":memory:"), { claudeHome: join(tmp, "claude") }));
    const inspected = (await teammate("POST", "/import/inspect", { path: repo })).data;
    expect(inspected.projectFile.project.id).toBe(projectId);
    expect(inspected.existingProjectId).toBeNull();
    const { status, data } = await teammate("POST", "/import", { path: repo });
    expect(status).toBe(201);
    expect(data.project.id).toBe(projectId);
    expect(data.progress.project).toBe(50);
    expect(data.dod.find((d: any) => d.status === "done").criterion).toBe("Paga con tarjeta");
    expect((await teammate("POST", "/import", { path: repo })).status).toBe(409);
  });

  test("sync re-reads the repo file after a pull", async () => {
    const path = join(repo, ".agent-tracking", "project.json");
    const file = JSON.parse(await readFile(path, "utf8"));
    file.rules.push({ id: "from-teammate", text: "Envío gratis sobre 50", priority: 9 });
    await Bun.write(path, JSON.stringify(file));
    const { data } = await call("POST", `/projects/${projectId}/sync`);
    expect(data.rules.map((r: any) => r.id)).toContain("from-teammate");
  });

  test("deleting a project cascades", async () => {
    expect((await call("DELETE", `/projects/${projectId}`)).status).toBe(204);
    expect((await call("GET", `/projects/${projectId}`)).status).toBe(404);
  });
});

describe("import", () => {
  test("inspecting a repo without a project file", async () => {
    const plain = join(tmp, "plain");
    await git(["init", "-q", "-b", "dev", plain]);
    const { data } = await call("POST", "/import/inspect", { path: plain });
    expect(data.repo).toMatchObject({ name: "plain", branch: "dev", remoteUrl: null });
    expect(data.projectFile).toBeNull();
    expect((await call("POST", "/import", { path: plain })).status).toBe(400);
  });

  test("invalid project file is reported", async () => {
    const broken = join(tmp, "broken");
    await git(["init", "-q", broken]);
    await Bun.write(join(broken, ".agent-tracking", "project.json"), "{ nope");
    const { data } = await call("POST", "/import/inspect", { path: broken });
    expect(data.projectFileError).toContain("no es JSON válido");
  });

  test("clone rejects non-GitHub urls", async () => {
    const { status, data } = await call("POST", "/import/clone", { url: "https://example.com/a/b", dest: join(tmp, "x") });
    expect(status).toBe(400);
    expect(data.error).toContain("github.com");
  });
});

describe("wizard helpers", () => {
  test("stack recommendation for several platforms", async () => {
    expect((await call("GET", "/stack/recommend?platforms=web,desktop")).data.stack).toContain("Tauri");
    expect((await call("GET", "/stack/recommend?platforms=tv")).status).toBe(400);
    expect((await call("GET", "/stack/options")).data.databases.length).toBeGreaterThan(3);
  });

  test("creating a skill makes it discoverable; duplicates are rejected", async () => {
    expect((await call("GET", "/skills/discover")).data).toEqual([]);
    const created = await call("POST", "/skills", { name: "Convenciones API", description: "REST con Hono" });
    expect(created.status).toBe(201);
    expect(created.data.name).toBe("convenciones-api");
    expect((await call("GET", "/skills/discover")).data.map((s: any) => s.name)).toEqual(["convenciones-api"]);
    expect((await call("POST", "/skills", { name: "Convenciones API", description: "x" })).status).toBe(409);
  });
});
