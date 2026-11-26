import { openDb, schema as s } from "@agent-tracking/db";
import { createTracker } from "@agent-tracking/tracking";
import { expect, test } from "bun:test";
import { createApp } from "./app";

test("activity log and test ideas", async () => {
  const db = openDb(":memory:");
  const tracker = createTracker(db);
  const app = createApp(db, { tracker });
  await db.insert(s.projects).values({ id: "p", name: "P", platforms: ["web"] });
  await db.insert(s.requirements).values({ id: "r", projectId: "p", title: "R" });
  const req = (method: string, path: string, json?: unknown) =>
    app.request(`/api${path}`, {
      method,
      headers: json ? { "Content-Type": "application/json" } : {},
      body: json ? JSON.stringify(json) : undefined,
    });

  expect((await req("GET", "/health")).status).toBe(200);
  await tracker.recordEvent("p", "agent:a", "start_feature", { name: "Uno" });
  await tracker.recordEvent("p", "agent:a", "report_file", { path: "a.ts" });
  const activity = await (await req("GET", "/projects/p/activity?limit=1")).json();
  expect(activity).toEqual([expect.objectContaining({ type: "report_file", payload: { path: "a.ts" } })]);
  expect((await req("GET", "/projects/nope/activity")).status).toBe(404);

  const created = await req("POST", "/projects/p/test-ideas", { text: "Caso borde", requirementId: "r" });
  expect(created.status).toBe(201);
  const idea = await created.json();
  expect(idea).toMatchObject({ origin: "human", status: "proposed", createdBy: "user:local" });
  expect((await req("POST", "/projects/p/test-ideas", { text: " " })).status).toBe(400);
  expect((await req("POST", "/projects/p/test-ideas", { text: "x", featureId: "nope" })).status).toBe(404);

  const patched = await (await req("PATCH", `/projects/p/test-ideas/${idea.id}`, { status: "accepted" })).json();
  expect(patched.status).toBe("accepted");
  const view = await (await req("GET", "/projects/p")).json();
  expect(view.testIdeas).toHaveLength(1);
  expect(view).toHaveProperty("files");
  expect((await req("DELETE", `/projects/p/test-ideas/${idea.id}`)).status).toBe(204);
});

test("a test reported by mistake can be removed", async () => {
  const db = openDb(":memory:");
  const tracker = createTracker(db);
  const app = createApp(db, { tracker });
  await db.insert(s.projects).values({ id: "p", name: "P", platforms: ["web"] });
  const reported = await tracker.reportTest("p", "agent:a", { path: "scratchpad/e2e/lang.ts", name: "e2e fuera del repo", result: "passing" });
  const del = (id: string, project = "p") => app.request(`/api/projects/${project}/tests/${id}`, { method: "DELETE" });
  expect((await del(reported.id, "nope")).status).toBe(404);
  expect((await del(reported.id)).status).toBe(204);
  expect((await (await app.request("/api/projects/p")).json()).tests).toHaveLength(0);
  expect((await del(reported.id)).status).toBe(404);
});
