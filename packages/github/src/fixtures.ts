/** Minimal GitHub API payloads and a fake `fetch` for tests (no network). */

export type FakeRoute = { status?: number; body?: unknown; headers?: Record<string, string> };
export type FakeHandler = (url: URL, init: RequestInit) => FakeRoute | undefined;

export type FakeFetch = typeof fetch & { calls: { url: string; headers: Headers }[] };

/** Routes requests by `METHOD /path` (query string ignored); unknown routes answer 404. */
export const fakeFetch = (routes: Record<string, FakeRoute | FakeHandler>): FakeFetch => {
  const calls: { url: string; headers: Headers }[] = [];
  const fn = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const headers = new Headers(init.headers);
    calls.push({ url: url.href, headers });
    const route = routes[`${(init.method ?? "GET").toUpperCase()} ${url.pathname}`];
    const res = (typeof route === "function" ? route(url, init) : route) ?? { status: 404, body: { message: "Not Found" } };
    const status = res.status ?? 200;
    return new Response(status === 304 ? null : JSON.stringify(res.body ?? {}), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-ratelimit-limit": "60",
        "x-ratelimit-remaining": "57",
        "x-ratelimit-used": "3",
        "x-ratelimit-reset": "1900000000",
        "x-ratelimit-resource": "core",
        ...res.headers,
      },
    });
  };
  return Object.assign(fn, { calls }) as unknown as FakeFetch;
};

const user = (login: string) => ({ login, avatar_url: `https://avatars.example/${login}` });

export const pull = (number: number, over: Record<string, unknown> = {}) => ({
  number,
  title: `PR ${number}`,
  state: "open",
  draft: false,
  merged_at: null,
  closed_at: null,
  created_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-02T10:00:00Z",
  html_url: `https://github.com/acme/tienda/pull/${number}`,
  user: user("ana"),
  head: { ref: `feature-${number}`, sha: `${number}`.padStart(40, "a") },
  base: { ref: "main" },
  body: "Descripción",
  additions: 10,
  deletions: 2,
  changed_files: 1,
  commits: 1,
  ...over,
});

export const run = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  name: "ci",
  workflow_id: 7,
  display_title: `Run ${id}`,
  head_branch: "main",
  head_sha: "b".repeat(40),
  event: "push",
  status: "completed",
  conclusion: "success",
  run_number: id,
  run_attempt: 1,
  actor: user("ana"),
  created_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-01T10:05:00Z",
  html_url: `https://github.com/acme/tienda/actions/runs/${id}`,
  ...over,
});

const R = "/repos/acme/tienda";

/** A small repository: two open PRs, one merged, one closed, two branches and one workflow. */
export const acmeRoutes = (): Record<string, FakeRoute | FakeHandler> => ({
  [`GET ${R}`]: { body: { default_branch: "main" } },
  "GET /rate_limit": { body: { resources: {} } },
  [`GET ${R}/pulls`]: (url) => {
    const all = [
      pull(1),
      pull(2, { draft: true }),
      pull(3, { state: "closed", merged_at: "2026-11-03T10:00:00Z", closed_at: "2026-11-03T10:00:00Z" }),
      pull(4, { state: "closed", closed_at: "2026-11-04T10:00:00Z" }),
    ];
    const state = url.searchParams.get("state") ?? "open";
    return { body: state === "all" ? all : all.filter((p) => p.state === state) };
  },
  [`GET ${R}/pulls/1`]: { body: pull(1) },
  [`GET ${R}/pulls/1/files`]: {
    body: [{ filename: "src/app.ts", status: "modified", additions: 10, deletions: 2 }],
  },
  [`GET ${R}/pulls/1/reviews`]: {
    body: [{ id: 11, user: user("luis"), state: "APPROVED", body: "", submitted_at: "2026-11-02T11:00:00Z", html_url: "https://github.com/r/11" }],
  },
  [`GET ${R}/issues/1/comments`]: {
    body: [{ id: 21, user: user("luis"), body: "Se ve bien", created_at: "2026-11-02T12:00:00Z", html_url: "https://github.com/c/21" }],
  },
  [`GET ${R}/pulls/1/comments`]: {
    body: [
      { id: 22, user: user("ana"), body: "Ojo aquí", path: "src/app.ts", created_at: "2026-11-02T09:00:00Z", html_url: "https://github.com/c/22" },
    ],
  },
  [`GET ${R}/commits/${"1".padStart(40, "a")}/check-runs`]: {
    body: {
      total_count: 2,
      check_runs: [
        { id: 31, name: "test", status: "completed", conclusion: "success", html_url: "https://github.com/k/31", started_at: null, completed_at: null },
        { id: 32, name: "lint", status: "in_progress", conclusion: null, html_url: "https://github.com/k/32", started_at: null, completed_at: null },
      ],
    },
  },
  [`GET ${R}/commits/${"1".padStart(40, "a")}/status`]: {
    body: { state: "failure", statuses: [{ id: 41, context: "deploy", state: "failure", target_url: null, created_at: "x", updated_at: "y" }] },
  },
  [`GET ${R}/branches`]: {
    body: [
      { name: "feature-1", protected: false, commit: { sha: "c".repeat(40) } },
      { name: "main", protected: true, commit: { sha: "d".repeat(40) } },
      { name: "old", protected: false, commit: { sha: "e".repeat(40) } },
    ],
  },
  [`GET ${R}/git/commits/${"c".repeat(40)}`]: {
    body: { message: "feat: carrito\n\ncuerpo", author: { name: "Ana", date: "2026-11-05T10:00:00Z" }, committer: { date: "2026-11-05T10:00:00Z" } },
  },
  [`GET ${R}/git/commits/${"d".repeat(40)}`]: {
    body: { message: "chore: base", author: { name: "Luis", date: "2026-11-01T10:00:00Z" }, committer: { date: "2026-11-01T10:00:00Z" } },
  },
  [`GET ${R}/git/commits/${"e".repeat(40)}`]: {
    body: { message: "old", author: { name: "Luis", date: "2025-01-01T10:00:00Z" }, committer: { date: "2025-01-01T10:00:00Z" } },
  },
  [`GET ${R}/actions/workflows`]: {
    body: { total_count: 1, workflows: [{ id: 7, name: "ci", path: ".github/workflows/ci.yml", state: "active", html_url: "https://github.com/w/7" }] },
  },
  [`GET ${R}/actions/runs`]: (url) => {
    const runs = [run(100), run(101, { status: "in_progress", conclusion: null, head_branch: "feature-1" }), run(102, { conclusion: "failure" })];
    const branch = url.searchParams.get("branch");
    return { body: { total_count: 3, workflow_runs: branch ? runs.filter((r) => r.head_branch === branch) : runs } };
  },
  [`GET ${R}/actions/workflows/7/runs`]: { body: { total_count: 1, workflow_runs: [run(100)] } },
  [`GET ${R}/actions/runs/100`]: { body: run(100) },
  [`GET ${R}/actions/runs/100/jobs`]: {
    body: {
      total_count: 1,
      jobs: [
        {
          id: 500,
          name: "build",
          status: "completed",
          conclusion: "failure",
          started_at: "2026-11-01T10:00:00Z",
          completed_at: "2026-11-01T10:04:00Z",
          html_url: "https://github.com/acme/tienda/actions/runs/100/job/500",
          steps: [
            { number: 1, name: "checkout", status: "completed", conclusion: "success", started_at: null, completed_at: null },
            { number: 2, name: "test", status: "completed", conclusion: "failure", started_at: null, completed_at: null },
          ],
        },
      ],
    },
  },
});
