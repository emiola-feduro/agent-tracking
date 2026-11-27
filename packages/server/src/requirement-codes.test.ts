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
