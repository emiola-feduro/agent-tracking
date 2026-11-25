import { AnalysisCache, analyzeFile, analyzeRepo, type RepoAnalysis } from "@agent-tracking/analyzer";
import { schema as s, type Db } from "@agent-tracking/db";
import {
  branchProgress,
  githubAccount,
  publishToGithub,
  toHttpsUrl,
  changedFilesBetween,
  diffSince,
  git,
  listWorktrees,
  readRepoFile,
  checkoutBranch,
  commitLog,
  currentBranch,
  GitError,
  listBranches,
  workingTreeChanges,
} from "@agent-tracking/git";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { writeRepoFiles } from "@agent-tracking/tracking";
import type { Emit } from "./app";

const STATUS: Record<GitError["code"], ContentfulStatusCode> = {
  not_repo: 400,
  invalid_ref: 400,
  invalid_path: 400,
  too_large: 413,
  not_found: 404,
  dirty: 409,
  git_failed: 500,
};

/** Turns library errors into HTTP errors with their Spanish message (handled by the app's onError). */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof GitError) {
      throw new HTTPException(STATUS[err.code], { message: err.message, cause: { code: err.code, ...(err.details as object | undefined) } });
    }
    throw err;
  }
}

const intParam = (v: string | undefined, def: number) => {
  const n = Number(v);
  return v !== undefined && Number.isFinite(n) ? n : def;
};

/**
 * Read-only repository endpoints (plus checkout) for projects with a local repository:
 *
 *   GET  /projects/:id/repo/branches                      → { current, branches }
 *   POST /projects/:id/repo/checkout { branch }           → { branch, previous }   (409 with uncommitted changes)
 *   GET  /projects/:id/repo/commits?ref&limit&skip&path   → { commits }
 *   GET  /projects/:id/repo/changes?from&to               → { files }  (no `from`: working tree)
 *   GET  /projects/:id/repo/analysis/file?path=           → FileAnalysis
 *   GET  /projects/:id/repo/analysis                      → RepoAnalysis (incremental, cached by content hash)
 *   GET  /projects/:id/repo/file?path&worktree            → FileContent (preview; `worktree` reads another checkout)
 *   GET  /projects/:id/repo/worktrees                     → { base, worktrees: Worktree & { progress } }
 *   GET  /projects/:id/repo/worktree-diff?worktree        → TurnDiff against where it left the base branch
 */
export function repoRoutes(db: Db, opts: { emit?: Emit } = {}) {
  const emit: Emit = opts.emit ?? (() => {});
  const caches = new Map<string, AnalysisCache>();
  const running = new Map<string, Promise<RepoAnalysis>>();
  const cacheFor = (root: string) => {
    let c = caches.get(root);
    if (!c) caches.set(root, (c = new AnalysisCache()));
    return c;
  };

  const repoOf = async (projectId: string) => {
    const [row] = await db.select({ repoPath: s.projects.repoPath }).from(s.projects).where(eq(s.projects.id, projectId)).limit(1);
    if (!row) throw new HTTPException(404, { message: "Proyecto no encontrado" });
    if (!row.repoPath) throw new HTTPException(400, { message: "El proyecto no tiene repositorio local" });
    return row.repoPath;
  };

  const app = new Hono();

  /** The branch the others are compared with: main, else master, else whatever the main checkout has. */
  const baseBranch = async (root: string) => {
    for (const name of ["main", "master"]) {
      if ((await git(["show-ref", "--verify", "--quiet", `refs/heads/${name}`], root)).ok) return name;
    }
    return (await currentBranch(root)) ?? null;
  };

  /** A checkout path from the client must be one of the repository's worktrees. */
  const checkoutOf = async (root: string, worktree: string | undefined) => {
    if (!worktree) return root;
    const list = await guard(() => listWorktrees(root));
    const found = list.find((w) => w.path === worktree);
    if (!found) throw new HTTPException(400, { message: "Ese worktree no pertenece al repositorio del proyecto" });
    return found.path;
  };

  app.get("/github/account", async (c) => c.json(await githubAccount()));

  /** Creates the project's repository on GitHub with gh, connects it as origin and pushes. */
  app.post("/projects/:id/github/publish", async (c) => {
    const id = c.req.param("id");
    const root = await repoOf(id);
    const parsed = z
      .object({
        owner: z.string().min(1).max(100),
        name: z.string().min(1).max(100),
        visibility: z.enum(["private", "public"]).default("private"),
        description: z.string().max(300).optional(),
      })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new HTTPException(400, { message: z.prettifyError(parsed.error) });
    const result = await guard(() => publishToGithub(root, parsed.data));
    const repoUrl = toHttpsUrl(result.url);
    await db.update(s.projects).set({ repoUrl, updatedAt: new Date().toISOString() }).where(eq(s.projects.id, id));
    await writeRepoFiles(db, id).catch(() => {});
    emit({ type: "changed", projectId: id, entity: "project" });
    return c.json({ ...result, repoUrl }, 201);
  });

  app.get("/projects/:id/repo/file", async (c) => {
    const root = await repoOf(c.req.param("id"));
    const path = c.req.query("path");
    if (!path) throw new HTTPException(400, { message: "Falta el parámetro 'path'" });
    const checkout = await checkoutOf(root, c.req.query("worktree"));
    return c.json(await guard(() => readRepoFile(checkout, path)));
  });

  app.get("/projects/:id/repo/worktrees", async (c) => {
    const root = await repoOf(c.req.param("id"));
    const [list, base] = await Promise.all([guard(() => listWorktrees(root)), baseBranch(root)]);
    const worktrees = await Promise.all(
      list.map(async (w) => ({
        ...w,
        progress: w.prunable ? null : await branchProgress(w.path, w.branch === base ? null : base).catch(() => null),
      })),
    );
    return c.json({ base, worktrees });
  });

  app.get("/projects/:id/repo/worktree-diff", async (c) => {
    const root = await repoOf(c.req.param("id"));
    const checkout = await checkoutOf(root, c.req.query("worktree"));
    const base = await baseBranch(root);
    const mergeBase = base ? await git(["merge-base", base, "HEAD"], checkout) : null;
    const head = await git(["rev-parse", "--verify", "-q", "HEAD"], checkout);
    const from = mergeBase?.ok && mergeBase.stdout ? mergeBase.stdout : head.ok ? head.stdout : null;
    return c.json(await guard(() => diffSince(checkout, { commit: from, untracked: [] })));
  });

  app.get("/projects/:id/repo/branches", async (c) => {
    const root = await repoOf(c.req.param("id"));
    return c.json(await guard(async () => ({ current: await currentBranch(root), branches: await listBranches(root) })));
  });

  app.post("/projects/:id/repo/checkout", async (c) => {
    const id = c.req.param("id");
    const root = await repoOf(id);
    const parsed = z.object({ branch: z.string().min(1) }).safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new HTTPException(400, { message: "Falta el nombre de la rama" });
    const result = await guard(() => checkoutBranch(root, parsed.data.branch));
    if (result.previous !== result.branch) emit({ type: "changed", projectId: id, entity: "repo" });
    return c.json(result);
  });

  app.get("/projects/:id/repo/commits", async (c) => {
    const root = await repoOf(c.req.param("id"));
    const q = c.req.query();
    const commits = await guard(() =>
      commitLog(root, { ref: q.ref || undefined, path: q.path || undefined, limit: intParam(q.limit, 50), skip: intParam(q.skip, 0) }),
    );
    return c.json({ commits });
  });

  app.get("/projects/:id/repo/changes", async (c) => {
    const root = await repoOf(c.req.param("id"));
    const { from, to } = c.req.query();
    if (!from && to) throw new HTTPException(400, { message: "Indica también 'from' para comparar referencias" });
    const files = await guard(() => (from ? changedFilesBetween(root, from, to || "HEAD") : workingTreeChanges(root)));
    return c.json({ from: from ?? null, to: from ? (to || "HEAD") : null, files });
  });

  app.get("/projects/:id/repo/analysis/file", async (c) => {
    const root = await repoOf(c.req.param("id"));
    const path = c.req.query("path");
    if (!path) throw new HTTPException(400, { message: "Falta el parámetro 'path'" });
    const result = await guard(() => analyzeFile(root, path, cacheFor(root)));
    if (!result) throw new HTTPException(415, { message: "Lenguaje no soportado (TypeScript, TSX, JavaScript o Python)" });
    return c.json(result);
  });

  app.get("/projects/:id/repo/analysis", async (c) => {
    const root = await repoOf(c.req.param("id"));
    // Concurrent requests for the same repo share one run.
    let run = running.get(root);
    if (!run) {
      run = guard(() => analyzeRepo(root, { cache: cacheFor(root) })).finally(() => running.delete(root));
      running.set(root, run);
    }
    return c.json(await run);
  });

  return app;
}
