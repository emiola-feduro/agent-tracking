import { openDb, schema as s } from "@agent-tracking/db";
import { GithubClient, staticAuthProvider } from "@agent-tracking/github";
import { acmeRoutes, fakeFetch, pull, run } from "@agent-tracking/github/src/fixtures";
import { beforeEach, describe, expect, test } from "bun:test";
import { createApp, type AppEvent } from "./app";
import { GithubWatcher } from "./github-watcher";

const anonymous = staticAuthProvider({ kind: "anonymous" });

let call: (method: string, path: string) => Promise<{ status: number; data: any }>;
let db: ReturnType<typeof openDb>;

beforeEach(() => {
  db = openDb(":memory:");
  const base = { platforms: ["web" as const], stack: [], databases: [], goal: "" };
  db.insert(s.projects).values({ id: "p1", name: "Tienda", repoUrl: "https://github.com/acme/tienda", ...base }).run();
  db.insert(s.projects).values({ id: "p2", name: "Sin repo", repoUrl: null, ...base }).run();
  const client = new GithubClient({ auth: anonymous, fetch: fakeFetch(acmeRoutes()) });
  const app = createApp(db, { github: { client } });
  call = async (method, path) => {
    const res = await app.request(`/api${path}`, { method });
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  };
});

describe("github routes", () => {
  test("status reports auth kind and rate limit, never a token", async () => {
    const { data } = await call("GET", "/github/status");
    expect(data.auth).toEqual({ kind: "anonymous" });
    // No request made yet: the status asks GitHub's free /rate_limit endpoint.
    expect(data.rateLimit.remaining).toBe(57);
  });

  test("a project without repoUrl answers 409 no_repo; unknown project 404", async () => {
    const res = await call("GET", "/projects/p2/github/pulls");
    expect(res.status).toBe(409);
    expect(res.data.code).toBe("no_repo");
    expect((await call("GET", "/projects/nope/github/pulls")).status).toBe(404);
  });

  test("pull requests with state filter and detail", async () => {
    expect((await call("GET", "/projects/p1/github/pulls")).data.map((p: any) => p.number)).toEqual([1, 2]);
    expect((await call("GET", "/projects/p1/github/pulls?state=merged")).data.map((p: any) => p.number)).toEqual([3]);
    expect((await call("GET", "/projects/p1/github/pulls?state=raro")).status).toBe(400);
    const detail = await call("GET", "/projects/p1/github/pulls/1");
    expect(detail.data.files).toHaveLength(1);
    expect(detail.data.checksStatus).toBe("failure");
  });

  test("GitHub errors keep their code", async () => {
    const res = await call("GET", "/projects/p1/github/pulls/99");
    expect(res.status).toBe(404);
    expect(res.data.code).toBe("not_found");
  });

  test("branches, workflows, runs by branch and run detail", async () => {
    expect((await call("GET", "/projects/p1/github/branches")).data.map((b: any) => b.name)).toEqual(["main", "feature-1", "old"]);
    expect((await call("GET", "/projects/p1/github/workflows")).data[0].name).toBe("ci");
    expect((await call("GET", "/projects/p1/github/runs?branch=feature-1")).data.map((r: any) => r.id)).toEqual([101]);
    const runDetail = await call("GET", "/projects/p1/github/runs/100");
    expect(runDetail.data.jobs[0].steps).toHaveLength(2);
    expect((await call("GET", "/projects/p1/github/runs/abc")).status).toBe(400);
  });

  test("watch heartbeat accepts projects with a repository", async () => {
    expect((await call("POST", "/projects/p1/github/watch")).status).toBe(204);
    expect((await call("POST", "/projects/p2/github/watch")).status).toBe(409);
  });
});

describe("github watcher", () => {
  test("emits github.changed when a pull request or run changes state", async () => {
    const state = { pr1: pull(1), run: run(100, { status: "in_progress", conclusion: null }) };
    const routes = {
      ...acmeRoutes(),
      "GET /repos/acme/tienda/pulls": () => ({ body: [state.pr1] }),
      "GET /repos/acme/tienda/actions/runs": () => ({ body: { total_count: 1, workflow_runs: [state.run] } }),
    };
    const gh = new GithubClient({ auth: anonymous, fetch: fakeFetch(routes), ttlMs: 60_000 });
    const events: AppEvent[] = [];
    let now = 0;
    const watcher = new GithubWatcher(gh, async () => ({ owner: "acme", repo: "tienda" }), (e) => events.push(e), {
      now: () => now,
      watchTtlMs: 1000,
    });
    watcher.watch("p1");

    await watcher.pollOnce();
    expect(events).toEqual([]);

    // Changes are seen even inside the cache TTL: the poller revalidates.
    state.pr1 = pull(1, { state: "closed", merged_at: "2026-11-05T00:00:00Z" });
    state.run = run(100);
    await watcher.pollOnce();
    expect(events).toEqual([
      { type: "github.changed", projectId: "p1", entity: "pull", id: "1" },
      { type: "github.changed", projectId: "p1", entity: "run", id: "100" },
    ]);

    // Without heartbeats the project stops being polled.
    now = 5000;
    state.run = run(100, { conclusion: "failure" });
    await watcher.pollOnce();
    expect(events).toHaveLength(2);
  });
});
