import { openDb, schema as s } from "@agent-tracking/db";
import { GithubClient, staticAuthProvider } from "@agent-tracking/github";
import { acmeRoutes, fakeFetch } from "@agent-tracking/github/src/fixtures";
import { beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "./app";
import { createLiveActivity } from "./live-activity";

const R = "/repos/acme/tienda";
let call: (method: string, path: string) => Promise<{ status: number; data: any }>;
let deleted: string[];
let db: ReturnType<typeof openDb>;
let live: ReturnType<typeof createLiveActivity>;

beforeEach(() => {
  deleted = [];
  db = openDb(":memory:");
  db.insert(s.projects).values({ id: "p1", name: "Tienda", repoUrl: "https://github.com/acme/tienda", platforms: ["web"] }).run();
  const routes = {
    ...acmeRoutes(),
    [`GET ${R}/compare/main...feature-1`]: { body: { ahead_by: 2 } },
    [`GET ${R}/compare/main...old`]: { body: { ahead_by: 0 } },
    [`DELETE ${R}/git/refs/heads/old`]: () => (deleted.push("old"), { status: 204 }),
    [`DELETE ${R}/git/refs/heads/feature-1`]: () => (deleted.push("feature-1"), { status: 204 }),
  };
  const client = new GithubClient({ auth: staticAuthProvider({ kind: "token", source: "env", token: "t" }), fetch: fakeFetch(routes) });
  live = createLiveActivity();
  const app = createApp(db, { github: { client }, live });
  call = async (method, path) => {
    const res = await app.request(`/api${path}`, { method });
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  };
});

describe("deleting branches on GitHub", () => {
  test("a merged branch without pull request goes at once", async () => {
    expect((await call("DELETE", "/projects/p1/github/branches/old")).status).toBe(200);
    expect(deleted).toEqual(["old"]);
  });

  test("the default (and protected) branch never goes", async () => {
    const res = await call("DELETE", "/projects/p1/github/branches/main");
    expect(res).toMatchObject({ status: 409, data: { code: "default" } });
    expect(deleted).toEqual([]);
  });

  test("unmerged commits or an open pull request ask for confirmation first", async () => {
    const res = await call("DELETE", "/projects/p1/github/branches/feature-1");
    expect(res).toMatchObject({ status: 409, data: { code: "confirm", ahead: 2, pull: 1 } });
    expect(res.data.error).toContain("2 commits que no están en main");
    expect(res.data.error).toContain("#1");
    expect(deleted).toEqual([]);
    expect((await call("DELETE", "/projects/p1/github/branches/feature-1?force=1")).status).toBe(200);
    expect(deleted).toEqual(["feature-1"]);
  });

  test("a branch an agent is working on is kept, here too", async () => {
    db.insert(s.agentTurns).values({ id: "t1", projectId: "p1", sessionId: "s1", branch: "old", startedAt: new Date().toISOString() }).run();
    // A turn left open by a session that is no longer working does not hold the branch.
    expect((await call("GET", "/projects/p1/github/branches")).data.find((b: any) => b.name === "old").agent).toBe(false);
    live.record("p1", { agent: "claude-code", hook_event_name: "UserPromptSubmit", session_id: "s1", cwd: "/w/tienda", prompt: "trabaja" });
    const listed = (await call("GET", "/projects/p1/github/branches")).data.find((b: any) => b.name === "old");
    expect(listed.agent).toBe(true);
    expect((await call("DELETE", "/projects/p1/github/branches/old")).data.code).toBe("agent");
    expect(deleted).toEqual([]);
  });
});
