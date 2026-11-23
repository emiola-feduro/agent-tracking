import { describe, expect, test } from "bun:test";
import { staticAuthProvider, tokenAuthProvider } from "./auth";
import { CachedFetch, REVALIDATE_HEADER } from "./cache";
import { GithubClient } from "./client";
import { GithubError } from "./errors";
import { acmeRoutes, fakeFetch } from "./fixtures";
import { aggregateStatus, runStatus } from "./normalize";

const ref = { owner: "acme", repo: "tienda" };
const anonymous = staticAuthProvider({ kind: "anonymous" });
const client = (routes = acmeRoutes(), opts: { token?: string; ttlMs?: number } = {}) => {
  const f = fakeFetch(routes);
  const auth = opts.token ? staticAuthProvider({ kind: "token", source: "env", token: opts.token }) : anonymous;
  return { gh: new GithubClient({ auth, fetch: f, ttlMs: opts.ttlMs }), f };
};

describe("auth", () => {
  test("prefers GITHUB_TOKEN, then gh auth token, else anonymous", async () => {
    const gh = async () => ({ ok: true, stdout: "gho_from_cli" });
    expect(await tokenAuthProvider({ env: { GITHUB_TOKEN: "t1" }, spawn: gh }).resolve()).toEqual({ kind: "token", source: "env", token: "t1" });
    expect(await tokenAuthProvider({ env: {}, spawn: gh }).resolve()).toEqual({ kind: "token", source: "gh-cli", token: "gho_from_cli" });
    const noGh = async () => ({ ok: false, stdout: "" });
    expect(await tokenAuthProvider({ env: {}, spawn: noGh }).resolve()).toEqual({ kind: "anonymous" });
  });

  test("sends the token and never exposes it in authInfo", async () => {
    const { gh, f } = client(acmeRoutes(), { token: "secret-token" });
    await gh.listWorkflows(ref);
    expect(f.calls[0]!.headers.get("authorization")).toBe("token secret-token");
    expect(JSON.stringify(await gh.authInfo())).not.toContain("secret-token");
  });

  test("anonymous requests carry no authorization header", async () => {
    const { gh, f } = client();
    await gh.listWorkflows(ref);
    expect(f.calls[0]!.headers.has("authorization")).toBe(false);
    expect(await gh.authInfo()).toEqual({ kind: "anonymous" });
  });
});

describe("cache", () => {
  const etagRoutes = () => {
    let hits = 0;
    const f = fakeFetch({
      "GET /x": (_url, init) => {
        hits++;
        const inm = new Headers(init.headers).get("if-none-match");
        return inm === '"v1"' ? { status: 304 } : { body: { v: 1 }, headers: { etag: '"v1"' } };
      },
    });
    return { f, hits: () => hits };
  };

  test("serves fresh entries without a request and revalidates stale ones with the ETag", async () => {
    let now = 0;
    const { f, hits } = etagRoutes();
    const cache = new CachedFetch(f, { ttlMs: 1000, now: () => now });
    expect(await (await cache.fetch("https://api.github.com/x")).json()).toEqual({ v: 1 });
    await cache.fetch("https://api.github.com/x");
    expect(hits()).toBe(1);
    now = 2000;
    const res = await cache.fetch("https://api.github.com/x");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ v: 1 });
    expect(hits()).toBe(2);
    expect(f.calls[1]!.headers.get("if-none-match")).toBe('"v1"');
  });

  test("the revalidate header skips the TTL and is not forwarded", async () => {
    const { f, hits } = etagRoutes();
    const cache = new CachedFetch(f, { ttlMs: 60_000 });
    await cache.fetch("https://api.github.com/x");
    await cache.fetch("https://api.github.com/x", { headers: { [REVALIDATE_HEADER]: "1" } });
    expect(hits()).toBe(2);
    expect(f.calls[1]!.headers.has(REVALIDATE_HEADER)).toBe(false);
  });

  test("records the core rate limit", async () => {
    const cache = new CachedFetch(fakeFetch({ "GET /x": { body: {} } }));
    await cache.fetch("https://api.github.com/x");
    expect(cache.rateLimit).toEqual({ limit: 60, remaining: 57, used: 3, resetAt: new Date(1900000000 * 1000).toISOString(), resource: "core" });
  });

  test("evicts the oldest entries beyond maxEntries", async () => {
    const cache = new CachedFetch(fakeFetch({ "GET /a": { body: 1 }, "GET /b": { body: 2 }, "GET /c": { body: 3 } }), { maxEntries: 2 });
    for (const p of ["a", "b", "c"]) await cache.fetch(`https://api.github.com/${p}`);
    expect(cache.size).toBe(2);
  });

  test("shares one request between concurrent identical GETs", async () => {
    const { f, hits } = etagRoutes();
    const cache = new CachedFetch(f);
    await Promise.all([cache.fetch("https://api.github.com/x"), cache.fetch("https://api.github.com/x")]);
    expect(hits()).toBe(1);
  });
});

describe("pull requests", () => {
  test("filters open, merged and closed", async () => {
    const { gh } = client();
    expect((await gh.listPulls(ref, "open")).map((p) => [p.number, p.state])).toEqual([
      [1, "open"],
      [2, "draft"],
    ]);
    expect((await gh.listPulls(ref, "merged")).map((p) => p.number)).toEqual([3]);
    expect((await gh.listPulls(ref, "closed")).map((p) => p.number)).toEqual([4]);
    expect(await gh.listPulls(ref, "all")).toHaveLength(4);
  });

  test("detail joins files, reviews, comments and checks", async () => {
    const { gh } = client();
    const d = await gh.getPull(ref, 1);
    expect(d.files).toEqual([
      { filename: "src/app.ts", status: "modified", additions: 10, deletions: 2, url: "https://github.com/acme/tienda/pull/1/files" },
    ]);
    expect(d.reviews[0]).toMatchObject({ state: "approved", author: { login: "luis" } });
    // Issue and inline comments merged in chronological order.
    expect(d.comments.map((c) => [c.id, c.path])).toEqual([
      [22, "src/app.ts"],
      [21, null],
    ]);
    expect(d.checks.map((c) => [c.name, c.status])).toEqual([
      ["test", "success"],
      ["lint", "running"],
      ["deploy", "failure"],
    ]);
    expect(d.checksStatus).toBe("failure");
  });

  test("maps GitHub errors to codes", async () => {
    const { gh } = client({
      ...acmeRoutes(),
      "GET /repos/acme/tienda/pulls": { status: 403, body: { message: "API rate limit exceeded" }, headers: { "x-ratelimit-remaining": "0" } },
    });
    const err = await gh.listPulls(ref).catch((e) => e);
    expect(err).toBeInstanceOf(GithubError);
    expect(err.code).toBe("rate_limited");
    expect(err.resetAt).toBe(new Date(1900000000 * 1000).toISOString());
    const missing = await gh.getPull(ref, 99).catch((e) => e);
    expect(missing.code).toBe("not_found");
  });
});

describe("branches", () => {
  test("default branch first, then newest commit, with their pull requests", async () => {
    const { gh } = client();
    const branches = await gh.listBranches(ref);
    expect(branches.map((b) => b.name)).toEqual(["main", "feature-1", "old"]);
    expect(branches[0]).toMatchObject({ isDefault: true, protected: true, commit: { message: "chore: base", author: "Luis" } });
    expect(branches[1]!.pull).toEqual({ number: 1, state: "open", url: "https://github.com/acme/tienda/pull/1" });
    expect(branches[1]!.commit?.message).toBe("feat: carrito");
    expect(branches[2]!.pull).toBeNull();
  });

  test("limits commit lookups and caches commits by sha", async () => {
    const f = fakeFetch(acmeRoutes());
    const gh = new GithubClient({ auth: anonymous, fetch: f, ttlMs: 0, commitLookups: { token: 10, anonymous: 2 } });
    const branches = await gh.listBranches(ref);
    // "old" has no pull request and is not the default branch: skipped by the budget.
    expect(branches.find((b) => b.name === "old")!.commit).toBeNull();
    const commitCalls = () => f.calls.filter((c) => c.url.includes("/git/commits/")).length;
    expect(commitCalls()).toBe(2);
    await gh.listBranches(ref);
    expect(commitCalls()).toBe(2);
  });
});

describe("actions", () => {
  test("workflows and runs with unified status, filtered by branch or workflow", async () => {
    const { gh } = client();
    expect(await gh.listWorkflows(ref)).toEqual([{ id: 7, name: "ci", path: ".github/workflows/ci.yml", state: "active", url: "https://github.com/w/7" }]);
    expect((await gh.listRuns(ref)).map((r) => r.status)).toEqual(["success", "running", "failure"]);
    expect((await gh.listRuns(ref, { branch: "feature-1" })).map((r) => r.id)).toEqual([101]);
    expect((await gh.listRuns(ref, { workflowId: 7 })).map((r) => r.id)).toEqual([100]);
  });

  test("run detail lists jobs with steps and a link to the logs", async () => {
    const { gh } = client();
    const run = await gh.getRun(ref, 100);
    expect(run.jobs[0]).toMatchObject({ name: "build", status: "failure", url: "https://github.com/acme/tienda/actions/runs/100/job/500" });
    expect(run.jobs[0]!.steps.map((s) => s.status)).toEqual(["success", "failure"]);
  });
});

describe("normalize", () => {
  test("run status and aggregation", () => {
    expect(runStatus("queued", null)).toBe("running");
    expect(runStatus("completed", "timed_out")).toBe("failure");
    expect(runStatus("completed", "skipped")).toBe("skipped");
    expect(aggregateStatus([])).toBeNull();
    expect(aggregateStatus(["success", "running"])).toBe("running");
    expect(aggregateStatus(["success", "skipped"])).toBe("success");
  });
});
