import {
  buildContextMarkdown,
  DATABASE_OPTIONS,
  featureProgress,
  PLATFORMS,
  projectProgress,
  recommendStack,
  requirementProgress,
  STACK_OPTIONS,
  toPercent,
  type ProjectSnapshot,
} from "@agent-tracking/core";
import {
  AssistantError,
  describeAssistantError,
  MAX_SKILLS,
  providerOf,
  suggestDod,
  suggestSkills,
  suggestStack,
  type AssistantConfig,
  type ProjectBrief,
} from "@agent-tracking/assistant";
import { loadSnapshot, schema as s, type Db } from "@agent-tracking/db";
import { cloneGithub, inspectRepo } from "@agent-tracking/git";
import { discoverCatalogSkills, discoverSkills, skillTemplate } from "@agent-tracking/skills";
import { and, eq, or } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { z } from "zod";
import { createTracker, LOCAL_USER, TrackingError, type Emit, type Tracker } from "@agent-tracking/tracking";
import { githubRoutes, type GithubOptions } from "./github-routes";
import { insertProjectFile, readRepoFile, replaceFromFile, writeRepoFiles } from "./repo-sync";
import { traceabilityRoutes } from "./traceability-routes";
import { repoRoutes } from "./repo-routes";
import { createLiveActivity, type HookPayload, type LiveActivity } from "./live-activity";

export type { AppEvent, Emit } from "@agent-tracking/tracking";

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const platforms = z.array(z.enum(PLATFORMS));

const dodInput = z.object({ criterion: z.string().min(1), origin: z.enum(["human", "llm"]).default("human") });
const requirementInput = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  weight: z.number().positive().default(1),
  dod: z.array(dodInput).default([]),
});
const skillInput = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  source: z.enum(["user", "repo", "plugin", "catalog", "created"]),
  location: z.string(),
  enabled: z.boolean().default(true),
});
const projectFields = z.object({
  name: z.string().min(1),
  goal: z.string().default(""),
  platforms: platforms.min(1, "Elige al menos una plataforma"),
  stack: z.array(z.string()).default([]),
  databases: z.array(z.string()).default([]),
  repoPath: z.string().nullable().default(null),
  repoUrl: z.string().nullable().default(null),
});
const createProject = projectFields.extend({
  rules: z.array(z.string().min(1)).default([]),
  skills: z.array(skillInput).default([]),
  requirements: z.array(requirementInput).default([]),
});

async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new HTTPException(400, { message: z.prettifyError(parsed.error) });
  return parsed.data;
}

function withProgress(snap: ProjectSnapshot) {
  return {
    ...snap,
    progress: {
      project: toPercent(projectProgress(snap)),
      requirements: Object.fromEntries(snap.requirements.map((r) => [r.id, toPercent(requirementProgress(snap, r.id))])),
      features: Object.fromEntries(snap.features.map((f) => [f.id, toPercent(featureProgress(f, snap.tests))])),
    },
  };
}

export interface AppOptions {
  emit?: Emit;
  /** User skills directory (defaults to ~/.claude) */
  claudeHome?: string;
  /** Default parent folder for GitHub clones (defaults to ~/repos) */
  cloneRoot?: string;
  /** Shared with the MCP server so both write and notify the same way. */
  tracker?: Tracker;
  /** Analyses a project's repository now (see repo-watchers.ts). */
  syncRepo?: (projectId: string, scope: "changes" | "all") => Promise<unknown>;
  /** GitHub client and background polling (see github-routes.ts). */
  github?: GithubOptions;
  /** Claude assistant; null or missing keeps the deterministic behaviour (see assistantConfigFromEnv). */
  assistant?: AssistantConfig | null;
  /** What agents are doing right now, fed by Claude Code hooks (see live-activity.ts). */
  live?: LiveActivity;
}

const NOT_CONFIGURED = "El asistente no está configurado. Define ANTHROPIC_API_KEY en el entorno del servidor y reinícialo.";

const briefInput = z.object({
  name: z.string().max(200).optional(),
  goal: z.string().max(4000).optional(),
  platforms: platforms.min(1, "Elige al menos una plataforma"),
  stack: z.array(z.string().max(100)).max(60).optional(),
  databases: z.array(z.string().max(100)).max(30).optional(),
  rules: z.array(z.string().max(1000)).max(50).optional(),
  requirements: z.array(z.object({ title: z.string().max(300), description: z.string().max(2000).optional() })).max(50).optional(),
});

const briefFromSnapshot = (snap: ProjectSnapshot): ProjectBrief => ({
  name: snap.project.name,
  goal: snap.project.goal,
  platforms: snap.project.platforms,
  stack: snap.project.stack,
  databases: snap.project.databases,
  rules: snap.rules.map((r) => r.text),
  requirements: snap.requirements.map((r) => ({ title: r.title, description: r.description })),
});

export function createApp(db: Db, opts: AppOptions = {}) {
  const tracker = opts.tracker ?? createTracker(db, { emit: opts.emit });
  const emit: Emit = tracker.emit;
  const claudeHome = opts.claudeHome ?? join(homedir(), ".claude");
  const cloneRoot = opts.cloneRoot ?? join(homedir(), "repos");
  const app = new Hono().basePath("/api");
  app.use("*", cors());

  app.onError((err, c) => {
    if (err instanceof TrackingError) return c.json({ error: err.message }, err.status);
    if (err instanceof HTTPException) return c.json({ error: err.message, ...((err.cause as object | undefined) ?? {}) }, err.status);
    console.error(err);
    return c.json({ error: "Error interno" }, 500);
  });

  app.route("/", githubRoutes(db, emit, opts.github));

  const snapshotOr404 = async (id: string) => {
    const snap = await loadSnapshot(db, id);
    if (!snap) throw new HTTPException(404, { message: "Proyecto no encontrado" });
    return snap;
  };

  const { touch, requirementIn } = tracker;

  /** Resolves a path to its git root; rejects anything that is not a repository. */
  const repoRootOr400 = async (path: string) => {
    const info = await inspectRepo(path.trim());
    if (!info) throw new HTTPException(400, { message: "La ruta no es un repositorio git (debe ser absoluta)" });
    return info;
  };

  const projectForRepo = async (root: string, fileProjectId?: string) => {
    const where = fileProjectId ? or(eq(s.projects.repoPath, root), eq(s.projects.id, fileProjectId)) : eq(s.projects.repoPath, root);
    const [row] = await db.select({ id: s.projects.id }).from(s.projects).where(where).limit(1);
    return row?.id ?? null;
  };

  const describeRepo = async (path: string) => {
    const repo = await repoRootOr400(path);
    const parsed = await readRepoFile(repo.root);
    const fileProjectId = parsed?.ok ? parsed.file.project.id : undefined;
    return {
      repo,
      projectFile: parsed?.ok ? parsed.file : null,
      projectFileError: parsed && !parsed.ok ? parsed.error : null,
      existingProjectId: await projectForRepo(repo.root, fileProjectId),
    };
  };

  // Claude assistant
  const assistant = opts.assistant ?? null;
  const assistantOr503 = () => {
    if (!assistant) throw new HTTPException(503, { message: NOT_CONFIGURED, cause: { configured: false } });
    return assistant;
  };
  /** Runs an assistant call; failures become a 502 without provider details. */
  const assisted = async <T>(what: string, run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      if (!(error instanceof AssistantError)) throw error;
      console.error(`Asistente (${what}): ${describeAssistantError(error)}`);
      throw new HTTPException(502, { message: "El asistente no pudo generar una sugerencia válida. Intenta de nuevo." });
    }
  };

  app.get("/assistant", (c) =>
    c.json(assistant ? { configured: true, provider: providerOf(assistant) } : { configured: false }),
  );

  app.post("/assistant/stack", async (c) => {
    const config = assistantOr503();
    const brief = await body(c, briefInput);
    return c.json(await suggestStack(config, brief, (e) => console.error(`Asistente (stack): ${describeAssistantError(e)}`)));
  });

  app.post("/assistant/dod", async (c) => {
    const config = assistantOr503();
    const input = await body(
      c,
      z.object({
        project: briefInput,
        requirement: z.object({ title: z.string().min(1).max(300), description: z.string().max(2000).optional() }),
        existing: z.array(z.string().max(1000)).max(50).default([]),
      }),
    );
    return c.json({ criteria: await assisted("dod", () => suggestDod(config, input)) });
  });

  app.post("/assistant/skills", async (c) => {
    const config = assistantOr503();
    const { project, skills } = await body(
      c,
      z.object({
        project: briefInput,
        skills: z.array(z.object({ id: z.string().min(1), name: z.string(), description: z.string().max(2000) })).max(MAX_SKILLS),
      }),
    );
    return c.json({ skills: await assisted("skills", () => suggestSkills(config, project, skills)) });
  });

  /** Same as /assistant/dod with the context read from the stored project. Nothing is saved. */
  app.post("/projects/:id/requirements/:reqId/dod/suggest", async (c) => {
    const config = assistantOr503();
    const { id: projectId, reqId } = c.req.param();
    const snap = await snapshotOr404(projectId);
    const requirement = await requirementIn(projectId, reqId);
    const existing = snap.dod.filter((d) => d.requirementId === reqId).map((d) => d.criterion);
    const criteria = await assisted("dod", () =>
      suggestDod(config, { project: briefFromSnapshot(snap), requirement, existing }),
    );
    return c.json({ criteria });
  });

  // Wizard helpers
  app.get("/stack/options", (c) => c.json({ stack: STACK_OPTIONS, databases: DATABASE_OPTIONS }));
  app.get("/stack/recommend", (c) => {
    const parsed = platforms.safeParse((c.req.query("platforms") ?? "").split(",").filter(Boolean));
    if (!parsed.success) throw new HTTPException(400, { message: "Plataformas inválidas" });
    return c.json(recommendStack(parsed.data));
  });

  app.get("/skills/discover", async (c) =>
    c.json(await discoverSkills({ claudeHome, repoPath: c.req.query("repoPath") || null })),
  );
  app.get("/skills/catalog", async (c) => c.json(await discoverCatalogSkills({ claudeHome })));

  app.post("/skills", async (c) => {
    const input = await body(
      c,
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        body: z.string().default(""),
        target: z.enum(["user", "repo"]).default("user"),
        repoPath: z.string().optional(),
      }),
    );
    const md = skillTemplate(input.name, input.description, input.body);
    const slug = md.match(/^name: (.*)$/m)?.[1]?.trim();
    if (!slug) throw new HTTPException(400, { message: "Nombre inválido" });
    if (input.target === "repo" && !input.repoPath) throw new HTTPException(400, { message: "Falta repoPath" });
    const base = input.target === "repo" ? join(input.repoPath!, ".claude", "skills") : join(claudeHome, "skills");
    const file = join(base, slug, "SKILL.md");
    if (await Bun.file(file).exists()) throw new HTTPException(409, { message: `La skill "${slug}" ya existe` });
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, md);
    return c.json({ name: slug, description: input.description, source: input.target, location: file }, 201);
  });

  // Import from a repository
  app.post("/import/inspect", async (c) => {
    const { path } = await body(c, z.object({ path: z.string().min(1) }));
    return c.json(await describeRepo(path));
  });

  app.get("/import/clone-root", (c) => c.json({ cloneRoot }));

  app.post("/import/clone", async (c) => {
    const { url, dest } = await body(c, z.object({ url: z.string().min(1), dest: z.string().min(1) }));
    try {
      const info = await cloneGithub(url, dest);
      return c.json(await describeRepo(info.root), 201);
    } catch (e) {
      if (e instanceof HTTPException) throw e;
      throw new HTTPException(400, { message: (e as Error).message });
    }
  });

  app.post("/import", async (c) => {
    const { path } = await body(c, z.object({ path: z.string().min(1) }));
    const { repo, projectFile, projectFileError, existingProjectId } = await describeRepo(path);
    if (existingProjectId) {
      throw new HTTPException(409, { message: "Este repositorio ya está en Agent Tracking", cause: { projectId: existingProjectId } });
    }
    if (!projectFile) throw new HTTPException(400, { message: projectFileError ?? "El repositorio no tiene .agent-tracking/project.json" });
    insertProjectFile(db, projectFile, repo.root);
    await writeRepoFiles(db, projectFile.project.id);
    emit({ type: "project.created", projectId: projectFile.project.id });
    return c.json(withProgress(await snapshotOr404(projectFile.project.id)), 201);
  });

  app.post("/projects/:id/sync", async (c) => {
    const id = c.req.param("id");
    const snap = await snapshotOr404(id);
    if (!snap.project.repoPath) throw new HTTPException(400, { message: "El proyecto no tiene repositorio local" });
    const parsed = await readRepoFile(snap.project.repoPath);
    if (!parsed) throw new HTTPException(404, { message: "El repositorio no tiene .agent-tracking/project.json" });
    if (!parsed.ok) throw new HTTPException(400, { message: parsed.error });
    replaceFromFile(db, id, parsed.file, snap.project.repoPath);
    emit({ type: "changed", projectId: id, entity: "project", id });
    return c.json(withProgress(await snapshotOr404(id)));
  });

  // Projects
  app.get("/projects", async (c) => {
    const rows = await db.select().from(s.projects).orderBy(s.projects.updatedAt);
    const out = await Promise.all(
      rows.map(async (p) => ({ ...p, progress: toPercent(projectProgress((await loadSnapshot(db, p.id))!)) })),
    );
    return c.json(out.reverse());
  });

  app.post("/projects", async (c) => {
    const input = await body(c, createProject);
    const { rules, skills, requirements, ...project } = input;
    if (project.repoPath) {
      const repo = await repoRootOr400(project.repoPath);
      const existing = await projectForRepo(repo.root);
      if (existing) throw new HTTPException(409, { message: "Este repositorio ya está en Agent Tracking", cause: { projectId: existing } });
      project.repoPath = repo.root;
      project.repoUrl ??= repo.remoteUrl;
    }
    const projectId = newId();
    db.transaction((tx) => {
      tx.insert(s.projects).values({ id: projectId, ...project }).run();
      rules.forEach((text, i) => tx.insert(s.businessRules).values({ id: newId(), projectId, text, priority: i + 1 }).run());
      skills.forEach((k) => tx.insert(s.projectSkills).values({ id: newId(), projectId, ...k }).run());
      for (const { dod, ...r } of requirements) {
        const requirementId = newId();
        tx.insert(s.requirements).values({ id: requirementId, projectId, ...r }).run();
        dod.forEach((d) => tx.insert(s.dodItems).values({ id: newId(), requirementId, ...d }).run());
      }
    });
    await writeRepoFiles(db, projectId);
    emit({ type: "project.created", projectId });
    return c.json(withProgress(await snapshotOr404(projectId)), 201);
  });

  app.get("/projects/:id", async (c) => c.json(withProgress(await snapshotOr404(c.req.param("id")))));

  app.patch("/projects/:id", async (c) => {
    const id = c.req.param("id");
    await snapshotOr404(id);
    const input = await body(c, projectFields.partial());
    if (input.repoPath) input.repoPath = (await repoRootOr400(input.repoPath)).root;
    await db.update(s.projects).set({ ...input, updatedAt: nowIso() }).where(eq(s.projects.id, id));
    await touch(id, "project", id);
    return c.json(withProgress(await snapshotOr404(id)));
  });

  app.delete("/projects/:id", async (c) => {
    const id = c.req.param("id");
    await db.delete(s.projects).where(eq(s.projects.id, id));
    emit({ type: "project.deleted", projectId: id });
    return c.body(null, 204);
  });

  app.get("/projects/:id/context.md", async (c) => {
    c.header("Content-Type", "text/markdown; charset=utf-8");
    return c.body(buildContextMarkdown(await snapshotOr404(c.req.param("id"))));
  });

  app.post("/projects/:id/context/write", async (c) => {
    const id = c.req.param("id");
    const snap = await snapshotOr404(id);
    if (!snap.project.repoPath) throw new HTTPException(400, { message: "El proyecto no tiene ruta de repositorio" });
    return c.json({ path: await writeRepoFiles(db, id) });
  });

  // Business rules
  const ruleInput = z.object({ text: z.string().min(1), priority: z.number().int().default(100) });
  app.post("/projects/:id/rules", async (c) => {
    const projectId = c.req.param("id");
    await snapshotOr404(projectId);
    const row = { id: newId(), projectId, ...(await body(c, ruleInput)) };
    await db.insert(s.businessRules).values(row);
    await touch(projectId, "rule", row.id);
    return c.json(row, 201);
  });
  app.patch("/projects/:id/rules/:ruleId", async (c) => {
    const { id: projectId, ruleId } = c.req.param();
    const input = await body(c, ruleInput.partial());
    const [row] = await db
      .update(s.businessRules)
      .set({ ...input, updatedAt: nowIso() })
      .where(and(eq(s.businessRules.id, ruleId), eq(s.businessRules.projectId, projectId)))
      .returning();
    if (!row) throw new HTTPException(404, { message: "Regla no encontrada" });
    await touch(projectId, "rule", ruleId);
    return c.json(row);
  });
  app.delete("/projects/:id/rules/:ruleId", async (c) => {
    const { id: projectId, ruleId } = c.req.param();
    await db.delete(s.businessRules).where(and(eq(s.businessRules.id, ruleId), eq(s.businessRules.projectId, projectId)));
    await touch(projectId, "rule", ruleId);
    return c.body(null, 204);
  });

  // Project skills
  app.post("/projects/:id/skills", async (c) => {
    const projectId = c.req.param("id");
    await snapshotOr404(projectId);
    const row = { id: newId(), projectId, ...(await body(c, skillInput)) };
    await db.insert(s.projectSkills).values(row);
    await touch(projectId, "skill", row.id);
    return c.json(row, 201);
  });
  app.patch("/projects/:id/skills/:skillId", async (c) => {
    const { id: projectId, skillId } = c.req.param();
    const input = await body(c, z.object({ enabled: z.boolean() }));
    const [row] = await db
      .update(s.projectSkills)
      .set(input)
      .where(and(eq(s.projectSkills.id, skillId), eq(s.projectSkills.projectId, projectId)))
      .returning();
    if (!row) throw new HTTPException(404, { message: "Skill no encontrada" });
    await touch(projectId, "skill", skillId);
    return c.json(row);
  });
  app.delete("/projects/:id/skills/:skillId", async (c) => {
    const { id: projectId, skillId } = c.req.param();
    await db.delete(s.projectSkills).where(and(eq(s.projectSkills.id, skillId), eq(s.projectSkills.projectId, projectId)));
    await touch(projectId, "skill", skillId);
    return c.body(null, 204);
  });

  // Requirements and Definition of Done
  app.post("/projects/:id/requirements", async (c) => {
    const projectId = c.req.param("id");
    await snapshotOr404(projectId);
    const { dod, ...r } = await body(c, requirementInput);
    const requirementId = newId();
    db.transaction((tx) => {
      tx.insert(s.requirements).values({ id: requirementId, projectId, ...r }).run();
      dod.forEach((d) => tx.insert(s.dodItems).values({ id: newId(), requirementId, ...d }).run());
    });
    await touch(projectId, "requirement", requirementId);
    return c.json({ id: requirementId }, 201);
  });
  app.patch("/projects/:id/requirements/:reqId", async (c) => {
    const { id: projectId, reqId } = c.req.param();
    await requirementIn(projectId, reqId);
    const input = await body(c, requirementInput.omit({ dod: true }).partial());
    await db.update(s.requirements).set({ ...input, updatedAt: nowIso() }).where(eq(s.requirements.id, reqId));
    await touch(projectId, "requirement", reqId);
    return c.json({ id: reqId });
  });
  app.delete("/projects/:id/requirements/:reqId", async (c) => {
    const { id: projectId, reqId } = c.req.param();
    await db.delete(s.requirements).where(and(eq(s.requirements.id, reqId), eq(s.requirements.projectId, projectId)));
    await touch(projectId, "requirement", reqId);
    return c.body(null, 204);
  });

  app.post("/projects/:id/requirements/:reqId/dod", async (c) => {
    const { id: projectId, reqId } = c.req.param();
    await requirementIn(projectId, reqId);
    const row = { id: newId(), requirementId: reqId, ...(await body(c, dodInput)) };
    await db.insert(s.dodItems).values(row);
    await touch(projectId, "dod", row.id);
    return c.json(row, 201);
  });
  app.patch("/projects/:id/requirements/:reqId/dod/:dodId", async (c) => {
    const { id: projectId, reqId, dodId } = c.req.param();
    await requirementIn(projectId, reqId);
    const input = await body(
      c,
      z
        .object({
          criterion: z.string().min(1),
          status: z.enum(["pending", "done", "failed"]),
          evidence: z.string().nullable(),
        })
        .partial(),
    );
    return c.json(await tracker.updateDod(projectId, LOCAL_USER, dodId, input, reqId));
  });
  app.delete("/projects/:id/requirements/:reqId/dod/:dodId", async (c) => {
    const { id: projectId, reqId, dodId } = c.req.param();
    await requirementIn(projectId, reqId);
    await db.delete(s.dodItems).where(and(eq(s.dodItems.id, dodId), eq(s.dodItems.requirementId, reqId)));
    await touch(projectId, "dod", dodId);
    return c.body(null, 204);
  });

  /** Files changed after the last agent report that covered them; `path` finds the project by its repo. */
  app.get("/report/pending", async (c) => {
    const path = c.req.query("path");
    const ref = c.req.query("project") ?? path;
    if (!ref) throw new HTTPException(400, { message: "Indica project o path" });
    const projectId = await tracker.resolveProject(ref);
    if (!projectId) return c.json({ projectId: null, pending: [] });
    if (opts.syncRepo) await opts.syncRepo(projectId, "changes").catch(() => {});
    return c.json({ projectId, pending: await tracker.pendingChanges(projectId) });
  });

  app.post("/projects/:id/repo/sync", async (c) => {
    if (!opts.syncRepo) throw new HTTPException(503, { message: "El análisis del repositorio no está disponible" });
    const id = c.req.param("id");
    const project = await tracker.projectOr404(id);
    if (!project.repoPath) throw new HTTPException(400, { message: "El proyecto no tiene repositorio local" });
    const { scope } = await body(c, z.object({ scope: z.enum(["changes", "all"]).default("changes") }));
    return c.json(await opts.syncRepo(id, scope));
  });

  // Live agent activity. Claude Code hooks post their raw payload here (see README); the answer is
  // always empty so nothing reaches the agent's context.
  const live = opts.live ?? createLiveActivity();
  const projectByCwd = new Map<string, { projectId: string | null; root: string | null; until: number }>();
  const resolveCwd = async (cwd: string) => {
    const hit = projectByCwd.get(cwd);
    if (hit && hit.until > Date.now()) return hit;
    const projectId = await tracker.resolveProject(cwd);
    const project = projectId ? await db.query.projects.findFirst({ where: eq(s.projects.id, projectId), columns: { repoPath: true } }) : null;
    const entry = { projectId, root: project?.repoPath ?? null, until: Date.now() + 30_000 };
    projectByCwd.set(cwd, entry);
    return entry;
  };

  app.post("/agent/hook", async (c) => {
    const payload = (await c.req.json().catch(() => null)) as HookPayload | null;
    if (!payload || typeof payload.cwd !== "string" || !isAbsolute(payload.cwd)) return c.body(null, 204);
    const { projectId, root } = await resolveCwd(payload.cwd);
    if (projectId && live.record(projectId, payload, root)) emit({ type: "live", projectId });
    return c.body(null, 204);
  });

  app.get("/projects/:id/live", async (c) => {
    const id = c.req.param("id");
    await tracker.projectOr404(id);
    return c.json(live.get(id));
  });

  app.route("/", traceabilityRoutes(tracker));
  // Branches, commits, checkout and code analysis (packages/git + packages/analyzer).
  app.route("/", repoRoutes(db, { emit }));

  return app;
}
