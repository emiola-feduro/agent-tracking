import type { Db } from "@agent-tracking/db";
import { schema as s } from "@agent-tracking/db";
import { parseGithubUrl } from "@agent-tracking/git";
import { GithubClient, GithubError, type PullFilter, type RepoRef } from "@agent-tracking/github";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Emit } from "./app";
import { GithubWatcher, type WatcherOptions } from "./github-watcher";

export type GithubOptions = {
  client?: GithubClient;
  watcher?: WatcherOptions;
};

const ERROR_STATUS: Record<GithubError["code"], ContentfulStatusCode> = {
  not_found: 404,
  rate_limited: 429,
  unauthorized: 401,
  upstream: 502,
};

const PULL_FILTERS = ["open", "closed", "merged", "all"] as const;

/**
 * Live GitHub data for a project's `repoUrl` (pull requests, branches, Actions). Nothing is stored:
 * responses come from GitHub through the client's in-memory ETag cache.
 *
 * FEATURE LINK: when the MCP features table exists, annotate pull requests, branches and runs with
 * the feature they belong to, matching the feature's branch name against `headRef` / `branch`
 * (and, as a fallback, the feature's commits against the pull request commits or the run `sha`).
 */
export function githubRoutes(db: Db, emit: Emit, opts: GithubOptions = {}) {
  const gh = opts.client ?? new GithubClient();
  const routes = new Hono();

  const repoOf = async (projectId: string): Promise<RepoRef | null> => {
    const [row] = await db.select({ repoUrl: s.projects.repoUrl }).from(s.projects).where(eq(s.projects.id, projectId));
    return row?.repoUrl ? parseGithubUrl(row.repoUrl) : null;
  };

  const watcher = new GithubWatcher(gh, repoOf, emit, opts.watcher);
  watcher.start();

  const repoOr4xx = async (projectId: string) => {
    const [row] = await db.select({ repoUrl: s.projects.repoUrl }).from(s.projects).where(eq(s.projects.id, projectId));
    if (!row) throw new HTTPException(404, { message: "Proyecto no encontrado" });
    const ref = row.repoUrl ? parseGithubUrl(row.repoUrl) : null;
    if (!ref) {
      throw new HTTPException(409, { message: "El proyecto no tiene un repositorio de GitHub vinculado", cause: { code: "no_repo" } });
    }
    return ref;
  };

  const github = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof GithubError)) throw e;
      throw new HTTPException(ERROR_STATUS[e.code], { message: e.message, cause: { code: e.code, resetAt: e.resetAt } });
    }
  };

  const positiveInt = (value: string | undefined, what: string) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) throw new HTTPException(400, { message: `${what} inválido` });
    return n;
  };

  const status = async () => ({ auth: await gh.authInfo(), rateLimit: await gh.currentRateLimit() });

  routes.get("/github/status", async (c) => c.json(await status()));
  routes.post("/github/auth/refresh", async (c) => {
    await gh.refreshAuth();
    return c.json(await status());
  });

  routes.post("/projects/:id/github/watch", async (c) => {
    const id = c.req.param("id");
    await repoOr4xx(id);
    watcher.watch(id);
    return c.body(null, 204);
  });

  routes.get("/projects/:id/github/pulls", async (c) => {
    const ref = await repoOr4xx(c.req.param("id"));
    const state = (c.req.query("state") ?? "open") as PullFilter;
    if (!PULL_FILTERS.includes(state)) throw new HTTPException(400, { message: "Estado inválido" });
    return c.json(await github(() => gh.listPulls(ref, state)));
  });

  routes.get("/projects/:id/github/pulls/:number", async (c) => {
    const ref = await repoOr4xx(c.req.param("id"));
    const number = positiveInt(c.req.param("number"), "Número de PR");
    return c.json(await github(() => gh.getPull(ref, number)));
  });

  routes.get("/projects/:id/github/branches", async (c) => {
    const ref = await repoOr4xx(c.req.param("id"));
    return c.json(await github(() => gh.listBranches(ref)));
  });

  routes.get("/projects/:id/github/workflows", async (c) => {
    const ref = await repoOr4xx(c.req.param("id"));
    return c.json(await github(() => gh.listWorkflows(ref)));
  });

  routes.get("/projects/:id/github/runs", async (c) => {
    const ref = await repoOr4xx(c.req.param("id"));
    const workflow = c.req.query("workflowId");
    const filter = {
      branch: c.req.query("branch") || undefined,
      workflowId: workflow ? positiveInt(workflow, "Workflow") : undefined,
    };
    return c.json(await github(() => gh.listRuns(ref, filter)));
  });

  routes.get("/projects/:id/github/runs/:runId", async (c) => {
    const ref = await repoOr4xx(c.req.param("id"));
    const runId = positiveInt(c.req.param("runId"), "Ejecución");
    return c.json(await github(() => gh.getRun(ref, runId)));
  });

  return Object.assign(routes, { watcher });
}
