import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createCollabClient, type CollabClient } from "./client";
import { can, isRole } from "./roles";
import { createCollabServer } from "./server";
import { openCollabStore, PRESENCE_TTL_MS, type CollabStore } from "./store";

let store: CollabStore;
let app: ReturnType<typeof createCollabServer>;
const inProcess = ((input: RequestInfo | URL, init?: RequestInit) => app.fetch(new Request(input, init))) as typeof fetch;
const client = (token?: string) => createCollabClient({ url: "http://collab.test", token, fetch: inProcess });

let ana: CollabClient;
let beto: CollabClient;
let carla: CollabClient;
let betoId: string;
let carlaId: string;
const tree = { ".agent-tracking/project.json": '{"v":1}\n' };

beforeAll(async () => {
  store = await openCollabStore(":memory:");
  app = createCollabServer(store);
  ana = client((await client().register("ana@equipo.test", "Ana", "secreto-ana")).token);
  const b = await client().register("beto@equipo.test", "Beto", "secreto-beto");
  beto = client(b.token);
  betoId = b.user.id;
  const c = await client().register("carla@equipo.test", "Carla", "secreto-carla");
  carla = client(c.token);
  carlaId = c.user.id;
});
afterAll(() => store.close());

describe("roles", () => {
  test("each role allows what the roles below it allow", () => {
    expect(can("viewer", "read")).toBe(true);
    expect(can("viewer", "push")).toBe(false);
    expect(can("editor", "push")).toBe(true);
    expect(can("editor", "manageMembers")).toBe(false);
    expect(can("owner", "manageMembers")).toBe(true);
    expect(can(null, "read")).toBe(false);
    expect(isRole("editor")).toBe(true);
    expect(isRole("admin")).toBe(false);
  });
});

describe("accounts", () => {
  test("login checks the password and the token identifies the person", async () => {
    await expect(client().login("ana@equipo.test", "otra-clave")).rejects.toMatchObject({ status: 401 });
    const { token, user } = await client().login("ANA@equipo.test", "secreto-ana");
    expect(user.name).toBe("Ana");
    expect((await client(token).me()).user.email).toBe("ana@equipo.test");
  });

  test("an email registers once and requests without a token are refused", async () => {
    await expect(client().register("ana@equipo.test", "Ana 2", "secreto-ana")).rejects.toMatchObject({ status: 409 });
    await expect(client().projects()).rejects.toMatchObject({ status: 401 });
    await expect(client("no-es-un-token").me()).rejects.toMatchObject({ status: 401 });
  });

  test("logout invalidates the token", async () => {
    const { token } = await client().login("beto@equipo.test", "secreto-beto");
    await client(token).logout();
    await expect(client(token).me()).rejects.toMatchObject({ status: 401 });
  });

  test("signup can be closed", async () => {
    const closed = createCollabServer(store, { allowSignup: false });
    const res = await closed.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nuevo@equipo.test", name: "Nuevo", password: "secreto-nuevo" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("a project shared with roles", () => {
  test("the person who shares it is its owner; others do not see it", async () => {
    expect(await ana.share("p1", "Tienda", tree)).toEqual({ revision: 1, role: "owner" });
    await expect(ana.share("p1", "Tienda", tree)).rejects.toMatchObject({ status: 409 });
    await expect(beto.project("p1")).rejects.toMatchObject({ status: 404 });
    expect((await beto.projects()).projects).toEqual([]);
  });

  test("only the owner manages members, and only registered emails", async () => {
    await expect(ana.setMember("p1", "nadie@equipo.test", "editor")).rejects.toMatchObject({ status: 404 });
    expect((await ana.setMember("p1", "beto@equipo.test", "editor")).member.role).toBe("editor");
    await ana.setMember("p1", "carla@equipo.test", "viewer");
    await expect(beto.setMember("p1", "carla@equipo.test", "owner")).rejects.toMatchObject({ status: 403 });
    const members = (await carla.members("p1")).members.map((m) => [m.name, m.role]);
    expect(members).toEqual([
      ["Ana", "owner"],
      ["Beto", "editor"],
      ["Carla", "viewer"],
    ]);
    expect((await beto.projects()).projects.map((p) => [p.id, p.role])).toEqual([["p1", "editor"]]);
  });

  test("editors push over the latest revision; a stale revision is refused", async () => {
    const next = { ...tree, ".agent-tracking/rules.json": "[]\n" };
    expect((await beto.push("p1", 1, "Tienda", next)).revision).toBe(2);
    await expect(ana.push("p1", 1, "Tienda", tree)).rejects.toMatchObject({ status: 409, body: { revision: 2 } });
    const p = await ana.project("p1");
    expect(p.revision).toBe(2);
    expect(p.tree).toEqual(next);
  });

  test("viewers read but cannot push", async () => {
    expect((await carla.project("p1")).role).toBe("viewer");
    await expect(carla.push("p1", 2, "Tienda", tree)).rejects.toMatchObject({ status: 403 });
  });

  test("the last owner cannot be demoted or removed", async () => {
    await expect(ana.setMember("p1", "ana@equipo.test", "editor")).rejects.toMatchObject({ status: 409 });
    const anaId = (await ana.me()).user.id;
    await expect(ana.removeMember("p1", anaId)).rejects.toMatchObject({ status: 409 });
  });

  test("members can leave; removing others needs the owner", async () => {
    await expect(beto.removeMember("p1", carlaId)).rejects.toMatchObject({ status: 403 });
    await carla.removeMember("p1", carlaId);
    await expect(carla.project("p1")).rejects.toMatchObject({ status: 404 });
    await ana.removeMember("p1", betoId);
    await expect(beto.project("p1")).rejects.toMatchObject({ status: 404 });
  });
});

describe("presence", () => {
  test("a heartbeat shows who works on the project until it expires", async () => {
    await ana.setMember("p1", "beto@equipo.test", "editor");
    await beto.heartbeat("p1", "RF2");
    const { presence } = await ana.heartbeat("p1", "Revisando");
    expect(presence.map((p) => [p.name, p.activity])).toEqual([
      ["Ana", "Revisando"],
      ["Beto", "RF2"],
    ]);
    expect(await store.presence("p1", Date.now() + PRESENCE_TTL_MS + 1000)).toEqual([]);
    await expect(carla.presence("p1")).rejects.toMatchObject({ status: 404 });
  });
});
