import { openDb } from "@agent-tracking/db";
import { createTracker } from "@agent-tracking/tracking";
import { expect, test } from "bun:test";
import { createApp } from "./app";

test("requirements get sequential codes by type, editable and unique, and the tracker finds them by code", async () => {
  const db = openDb(":memory:");
  const tracker = createTracker(db);
  const app = createApp(db, { tracker });
  const call = async (method: string, path: string, json?: unknown) => {
    const res = await app.request(`/api${path}`, {
      method,
      headers: json ? { "Content-Type": "application/json" } : {},
      body: json ? JSON.stringify(json) : undefined,
    });
    return { status: res.status, data: (await res.json().catch(() => null)) as any };
  };
  const created = await call("POST", "/projects", {
    name: "Tienda",
    kind: "api",
    requirements: [{ title: "Pagos con tarjeta", type: "functional" }, { title: "Responde en menos de 200 ms", type: "non_functional" }],
  });
  const id = created.data.project.id;
  const codes = async () => (await call("GET", `/projects/${id}`)).data.requirements.map((r: any) => r.code);
  expect(await codes()).toEqual(["RF1", "RNF1"]);

  const third = await call("POST", `/projects/${id}/requirements`, { title: "Carrito", type: "functional" });
  expect(third.data.code).toBe("RF2");
  expect((await call("POST", `/projects/${id}/requirements`, { title: "Otro", code: "rf2" })).status).toBe(409);

  expect((await call("PATCH", `/projects/${id}/requirements/${third.data.id}`, { code: "cart-1" })).status).toBe(200);
  expect(await codes()).toContain("CART-1");
  expect((await call("PATCH", `/projects/${id}/requirements/${third.data.id}`, { code: "RF1" })).status).toBe(409);
  expect((await call("PATCH", `/projects/${id}/requirements/${third.data.id}`, { code: "1 mal" })).status).toBe(400);
  // Keeping its own code is not a duplicate.
  expect((await call("PATCH", `/projects/${id}/requirements/${third.data.id}`, { code: "CART-1", title: "Carrito de compras" })).status).toBe(200);

  // Agents can write the code wherever a requirement is asked for.
  expect((await tracker.resolveRequirement(id, "cart-1")).id).toBe(third.data.id);
  const { feature } = await tracker.startFeature(id, "agent:test", { requirementId: "RF1", name: "Cobro" });
  const rf1 = (await call("GET", `/projects/${id}`)).data.requirements.find((r: any) => r.code === "RF1");
  expect(feature.requirementId).toBe(rf1.id);
  await expect(tracker.resolveRequirement(id, "RF99")).rejects.toThrow("RF99");
});

test("requirements written without a code get one, and an older process cannot write into a newer database", async () => {
  const { fillRequirementCodes } = await import("@agent-tracking/tracking");
  const { assertCurrentSchema, schema: s } = await import("@agent-tracking/db");
  const db = openDb(":memory:");
  await db.insert(s.projects).values({ id: "p", name: "P", platforms: ["web"] });
  // As an MCP running code from before codes would leave them.
  await db.insert(s.requirements).values([
    { id: "a", projectId: "p", title: "Uno", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "b", projectId: "p", title: "Dos", type: "non_functional", createdAt: "2026-01-02T00:00:00.000Z" },
    { id: "c", projectId: "p", title: "Tres", code: "RF1", createdAt: "2026-01-03T00:00:00.000Z" },
  ]);
  expect(fillRequirementCodes(db, "p")).toBe(2);
  const codes = Object.fromEntries((await db.select().from(s.requirements)).map((r) => [r.id, r.code]));
  expect(codes).toEqual({ a: "RF2", b: "RNF1", c: "RF1" });
  expect(fillRequirementCodes(db, "p")).toBe(0);

  expect(() => assertCurrentSchema(db)).not.toThrow();
  db.$client.run("INSERT INTO __migrations (tag, applied_at) VALUES ('9999_from_the_future', '2027-01-01')");
  expect(() => assertCurrentSchema(db)).toThrow("versión más nueva");
});

test("the architecture chosen in the wizard is stored, validated and reaches CONTEXT.md", async () => {
  const db = openDb(":memory:");
  const app = createApp(db, {});
  const post = async (json: unknown) => {
    const res = await app.request("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) });
    return { status: res.status, data: (await res.json()) as any };
  };
  expect((await post({ name: "X", kind: "api", architecture: { backend: "inventada" } })).status).toBe(400);
  const created = await post({ name: "Tienda", kind: "fullstack", platforms: ["web"], architecture: { frontend: "feature-based", backend: "hexagonal" } });
  expect(created.data.project.architecture).toEqual({ frontend: "feature-based", backend: "hexagonal" });
  const { buildContextMarkdown } = await import("@agent-tracking/core");
  const { loadSnapshot } = await import("@agent-tracking/db");
  const md = buildContextMarkdown((await loadSnapshot(db, created.data.project.id))!);
  expect(md).toContain("## Arquitectura");
  expect(md).toContain("Backend: Hexagonal (puertos y adaptadores)");
});
