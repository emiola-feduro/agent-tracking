import type { SymbolKind, TestIdeaStatus, TestResult, TestType } from "@agent-tracking/core";
import { loadSnapshot, schema as s, type Db } from "@agent-tracking/db";
import { inspectRepo, mainWorktreeOf } from "@agent-tracking/git";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { writeRepoFiles } from "./repo-sync";

export type AppEvent = { type: string; projectId: string; entity?: string; id?: string };
export type Emit = (e: AppEvent) => void;

/** Domain error with the HTTP status it maps to. MCP tools report its message to the agent. */
export class TrackingError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

export const LOCAL_USER = "user:local";
const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
/** "agent:claude-code" becomes "claude-code" for the feature's `agent` column. */
const actorName = (actor: string) => actor.replace(/^(agent|user):/, "");

export type FeatureStart = { requirementId: string; featureId?: string; name?: string; description?: string };
export type FileReport = { path: string; purpose?: string; featureIds?: string[] };
export type SymbolReport = {
  path: string;
  name: string;
  kind: SymbolKind;
  lineStart?: number | null;
  lineEnd?: number | null;
  purpose?: string;
  source?: "reported" | "inferred";
};
export type TestReport = {
  path: string;
  name: string;
  type?: TestType;
  result?: TestResult;
  featureId?: string | null;
  requirementId?: string | null;
};
export type TestIdeaInput = { text: string; featureId?: string | null; requirementId?: string | null; origin?: "human" | "llm" };

/** The single report an agent sends when it finishes, organised by requirement, feature and file. */
export type WorkReport = {
  summary?: string;
  features: {
    requirementId: string;
    name: string;
    featureId?: string;
    description?: string;
    status?: "in_progress" | "done" | "needs_review";
    files?: {
      path: string;
      purpose?: string;
      symbols?: { name: string; kind: SymbolKind; purpose?: string; lineStart?: number | null; lineEnd?: number | null }[];
    }[];
    tests?: { path: string; name: string; type?: TestType; result?: TestResult }[];
  }[];
  dod?: { id: string; status: "pending" | "done" | "failed"; evidence?: string | null }[];
  testIdeas?: { text: string; requirementId?: string | null }[];
};

export type PendingFile = { path: string; changedAt: string; reportedAt: string | null; symbols: number };

/**
 * Every write the API and the MCP server make goes through here, so both persist the same way:
 * the database row, the repository files (`project.json`, `CONTEXT.md`) and a live event.
 */
export function createTracker(db: Db, opts: { emit?: Emit } = {}) {
  const emit: Emit = opts.emit ?? (() => {});

  /** While > 0 (inside submitReport), per-item writes are skipped and done once at the end. */
  let batching = 0;

  /** Persists the shareable files into the repo and notifies live clients. */
  const touch = async (projectId: string, entity: string, id?: string) => {
    if (batching > 0) return;
    await writeRepoFiles(db, projectId).catch((e) => console.error("No se pudo escribir en el repo:", e));
    emit({ type: "changed", projectId, entity, id });
  };

  const projectOr404 = async (projectId: string) => {
    const p = await db.query.projects.findFirst({ where: eq(s.projects.id, projectId) });
    if (!p) throw new TrackingError("Proyecto no encontrado", 404);
    return p;
  };

  const requirementIn = async (projectId: string, reqId: string) => {
    const r = await db.query.requirements.findFirst({
      where: and(eq(s.requirements.id, reqId), eq(s.requirements.projectId, projectId)),
    });
    if (!r) throw new TrackingError(`Requerimiento no encontrado: ${reqId}`, 404);
    return r;
  };

  /** A requirement by id or by its code (RF1, case aside), as agents may write either. */
  const resolveRequirement = async (projectId: string, ref: string) => {
    const r = await db.query.requirements.findFirst({
      where: and(eq(s.requirements.projectId, projectId), or(eq(s.requirements.id, ref), sql`upper(${s.requirements.code}) = upper(${ref.trim()})`)),
    });
    if (!r) throw new TrackingError(`Requerimiento no encontrado: ${ref}`, 404);
    return r;
  };

  const featureIn = async (projectId: string, featureId: string) => {
    const [row] = await db
      .select({ feature: s.features })
      .from(s.features)
      .innerJoin(s.requirements, eq(s.features.requirementId, s.requirements.id))
      .where(and(eq(s.features.id, featureId), eq(s.requirements.projectId, projectId)))
      .limit(1);
    if (!row) throw new TrackingError(`Feature no encontrado: ${featureId}`, 404);
    return row.feature;
  };

  /** Normalizes a reported path to repo-relative with forward slashes; rejects paths outside the repo. */
  const repoRelative = (repoPath: string | null, path: string) => {
    const trimmed = path.trim();
    if (!trimmed) throw new TrackingError("La ruta del archivo está vacía");
    let rel = trimmed;
    if (isAbsolute(trimmed)) {
      if (!repoPath) throw new TrackingError("El proyecto no tiene repositorio local: usa una ruta relativa");
      rel = relative(repoPath, trimmed);
    } else if (repoPath) {
      rel = relative(repoPath, resolve(repoPath, trimmed));
    }
    rel = rel.split(sep).join("/").replace(/^\.\//, "");
    if (!rel || rel === "." || rel.startsWith("../") || rel === ".." || isAbsolute(rel)) {
      throw new TrackingError(`La ruta queda fuera del repositorio: ${path}`);
    }
    return rel;
  };

  const upsertFile = async (projectId: string, actor: string, path: string, purpose?: string) => {
    const project = await projectOr404(projectId);
    const rel = repoRelative(project.repoPath, path);
    const existing = await db.query.fileArtifacts.findFirst({
      where: and(eq(s.fileArtifacts.projectId, projectId), eq(s.fileArtifacts.path, rel)),
    });
    // Anything an agent says about a file counts as reporting it (see pendingChanges).
    const reportedAt = nowIso();
    if (existing) {
      const [row] = await db
        .update(s.fileArtifacts)
        .set({
          reportedAt,
          ...(purpose !== undefined && purpose !== existing.purpose ? { purpose, updatedBy: actor, updatedAt: reportedAt } : {}),
        })
        .where(eq(s.fileArtifacts.id, existing.id))
        .returning();
      return row!;
    }
    const [row] = await db
      .insert(s.fileArtifacts)
      .values({ id: newId(), projectId, path: rel, purpose: purpose ?? "", reportedAt, createdBy: actor, updatedBy: actor })
      .returning();
    return row!;
  };

  return {
    db,
    emit,
    touch,
    projectOr404,
    requirementIn,
    resolveRequirement,
    featureIn,

    /**
     * Finds a project by id or by a path inside its repository (an agent's cwd, for example).
     * Returns null when nothing matches.
     */
    async resolveProject(ref: string): Promise<string | null> {
      const value = ref.trim();
      if (!value) return null;
      const byId = await db.query.projects.findFirst({ where: eq(s.projects.id, value), columns: { id: true } });
      if (byId) return byId.id;
      if (!isAbsolute(value)) return null;
      const repo = await inspectRepo(value).catch(() => null);
      if (repo) {
        const byRoot = await db.query.projects.findFirst({ where: eq(s.projects.repoPath, repo.root), columns: { id: true } });
        if (byRoot) return byRoot.id;
        // An agent working in a worktree (git worktree add) belongs to the project of the main checkout.
        const main = await mainWorktreeOf(repo.root).catch(() => null);
        if (main && main !== repo.root) {
          const byMain = await db.query.projects.findFirst({ where: eq(s.projects.repoPath, main), columns: { id: true } });
          if (byMain) return byMain.id;
        }
      }
      // Paths that do not exist yet (or are not inside a git checkout): the deepest repo that contains them.
      const target = resolve(value);
      const rows = await db.select({ id: s.projects.id, repoPath: s.projects.repoPath }).from(s.projects);
      const match = rows
        .filter((p): p is { id: string; repoPath: string } => !!p.repoPath)
        .filter((p) => target === p.repoPath || target.startsWith(p.repoPath.endsWith(sep) ? p.repoPath : p.repoPath + sep))
        .sort((x, y) => y.repoPath.length - x.repoPath.length)[0];
      return match?.id ?? null;
    },

    /** Appends to the activity log and tells live clients right away. */
    async recordEvent(projectId: string, actor: string, type: string, payload: Record<string, unknown> = {}) {
      const row = { id: newId(), projectId, actor, type, payload, createdAt: nowIso() };
      await db.insert(s.agentEvents).values(row);
      emit({ type: "activity", projectId, entity: "event", id: row.id });
      return row;
    },

    async listEvents(projectId: string, opts: { limit?: number; before?: string } = {}) {
      const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
      const where = opts.before
        ? and(eq(s.agentEvents.projectId, projectId), lt(s.agentEvents.createdAt, opts.before))
        : eq(s.agentEvents.projectId, projectId);
      return db.select().from(s.agentEvents).where(where).orderBy(desc(s.agentEvents.createdAt)).limit(limit);
    },

    /** Creates the feature (or resumes an existing one with the same name) and marks it in progress. */
    async startFeature(projectId: string, actor: string, start: FeatureStart) {
      const input = { ...start, requirementId: (await resolveRequirement(projectId, start.requirementId)).id };
      let feature = input.featureId ? await featureIn(projectId, input.featureId) : undefined;
      if (feature && feature.requirementId !== input.requirementId) {
        throw new TrackingError("El feature pertenece a otro requerimiento");
      }
      const name = input.name?.trim();
      if (!feature && !name) throw new TrackingError("Indica featureId o name");
      if (!feature && name) {
        feature = await db.query.features.findFirst({
          where: and(eq(s.features.requirementId, input.requirementId), sql`lower(${s.features.name}) = lower(${name})`),
        });
      }
      const patch = { status: "in_progress" as const, agent: actorName(actor), updatedBy: actor, updatedAt: nowIso() };
      let created = false;
      if (feature) {
        const description = input.description?.trim();
        [feature] = await db
          .update(s.features)
          .set({ ...patch, ...(description ? { description } : {}) })
          .where(eq(s.features.id, feature.id))
          .returning();
      } else {
        created = true;
        [feature] = await db
          .insert(s.features)
          .values({
            id: newId(),
            requirementId: input.requirementId,
            name: name!,
            description: input.description?.trim() ?? "",
            createdBy: actor,
            ...patch,
          })
          .returning();
      }
      await touch(projectId, "feature", feature!.id);
      return { feature: feature!, created };
    },

    async completeFeature(projectId: string, actor: string, featureId: string, status: "done" | "needs_review" = "done") {
      await featureIn(projectId, featureId);
      const [feature] = await db
        .update(s.features)
        .set({ status, updatedBy: actor, updatedAt: nowIso() })
        .where(eq(s.features.id, featureId))
        .returning();
      await touch(projectId, "feature", featureId);
      return feature!;
    },

    /** Records a file and links it to the given features. Reporting it again updates the purpose and adds links. */
    async reportFile(projectId: string, actor: string, input: FileReport) {
      const featureIds = [...new Set(input.featureIds ?? [])];
      for (const featureId of featureIds) await featureIn(projectId, featureId);
      const file = await upsertFile(projectId, actor, input.path, input.purpose);
      for (const featureId of featureIds) {
        await db.insert(s.featureFiles).values({ featureId, fileId: file.id, createdBy: actor }).onConflictDoNothing();
      }
      await touch(projectId, "file", file.id);
      return { file, featureIds };
    },

    /** Records a function, class, variable, type or constant. The file is registered if it was not yet. */
    async reportSymbol(projectId: string, actor: string, input: SymbolReport) {
      const file = await upsertFile(projectId, actor, input.path);
      const values = {
        lineStart: input.lineStart ?? null,
        lineEnd: input.lineEnd ?? null,
        purpose: input.purpose ?? "",
        source: input.source ?? ("reported" as const),
        updatedBy: actor,
        updatedAt: nowIso(),
      };
      const [symbol] = await db
        .insert(s.symbols)
        .values({ id: newId(), fileId: file.id, name: input.name, kind: input.kind, createdBy: actor, ...values })
        .onConflictDoUpdate({ target: [s.symbols.fileId, s.symbols.name, s.symbols.kind], set: values })
        .returning();
      await touch(projectId, "symbol", symbol!.id);
      return { file, symbol: symbol! };
    },

    /** Upserts a test by path and name. A test linked to a feature inherits its requirement. */
    async reportTest(projectId: string, actor: string, input: TestReport) {
      const project = await projectOr404(projectId);
      const path = repoRelative(project.repoPath, input.path);
      let requirementId = input.requirementId ?? null;
      if (input.featureId) {
        const feature = await featureIn(projectId, input.featureId);
        requirementId ??= feature.requirementId;
      }
      if (requirementId) requirementId = (await resolveRequirement(projectId, requirementId)).id;
      const existing = await db.query.tests.findFirst({
        where: and(eq(s.tests.projectId, projectId), eq(s.tests.path, path), eq(s.tests.name, input.name)),
      });
      const values = {
        ...(input.type ? { type: input.type } : {}),
        ...(input.result ? { lastResult: input.result } : {}),
        ...(input.featureId !== undefined ? { featureId: input.featureId } : {}),
        ...(requirementId ? { requirementId } : {}),
        updatedBy: actor,
        updatedAt: nowIso(),
      };
      const [test] = existing
        ? await db.update(s.tests).set(values).where(eq(s.tests.id, existing.id)).returning()
        : await db
            .insert(s.tests)
            .values({ id: newId(), projectId, path, name: input.name, createdBy: actor, ...values })
            .returning();
      await touch(projectId, "test", test!.id);
      return test!;
    },

    /**
     * Takes a test out of the project (one reported by mistake, or that no longer exists). A test the
     * analyzer finds in the code comes back on the next sync while its file still has it.
     */
    async deleteTest(projectId: string, testId: string) {
      await projectOr404(projectId);
      const [removed] = await db.delete(s.tests).where(and(eq(s.tests.id, testId), eq(s.tests.projectId, projectId))).returning({ id: s.tests.id });
      if (!removed) throw new TrackingError("Test no encontrado", 404);
      await touch(projectId, "test", testId);
    },

    /** A test by the path and name it was reported with, as an agent remembers it. */
    async findTest(projectId: string, input: { path: string; name: string }) {
      const project = await projectOr404(projectId);
      const path = repoRelative(project.repoPath, input.path);
      const test = await db.query.tests.findFirst({
        where: and(eq(s.tests.projectId, projectId), eq(s.tests.path, path), eq(s.tests.name, input.name)),
      });
      if (!test) throw new TrackingError(`Test no encontrado: ${path} › ${input.name}`, 404);
      return test;
    },

    /**
     * Takes a feature reported by mistake out of its requirement. Its links to files go with it; its
     * tests, test ideas and screens stay in the project without a feature (returned so they can be removed too).
     */
    async deleteFeature(projectId: string, featureId: string) {
      const feature = await featureIn(projectId, featureId);
      const tests = await db
        .select({ id: s.tests.id, path: s.tests.path, name: s.tests.name })
        .from(s.tests)
        .where(and(eq(s.tests.projectId, projectId), eq(s.tests.featureId, featureId)));
      await db.delete(s.features).where(eq(s.features.id, featureId));
      await touch(projectId, "feature", featureId);
      return { feature, tests };
    },

    /** Updates a Definition of Done item. Used by the UI checkboxes and by agents with evidence. */
    async updateDod(
      projectId: string,
      actor: string,
      dodId: string,
      input: { criterion?: string; status?: "pending" | "done" | "failed"; evidence?: string | null },
      requirementId?: string,
    ) {
      const [row] = await db
        .select({ dod: s.dodItems })
        .from(s.dodItems)
        .innerJoin(s.requirements, eq(s.dodItems.requirementId, s.requirements.id))
        .where(
          and(
            eq(s.dodItems.id, dodId),
            eq(s.requirements.projectId, projectId),
            requirementId ? eq(s.dodItems.requirementId, requirementId) : undefined,
          ),
        )
        .limit(1);
      if (!row) throw new TrackingError(`Criterio no encontrado: ${dodId}`, 404);
      const [dod] = await db
        .update(s.dodItems)
        .set({ ...input, updatedBy: actor, updatedAt: nowIso() })
        .where(eq(s.dodItems.id, dodId))
        .returning();
      await touch(projectId, "dod", dodId);
      return dod!;
    },

    async addTestIdea(projectId: string, actor: string, input: TestIdeaInput) {
      await projectOr404(projectId);
      let requirementId = input.requirementId ?? null;
      if (input.featureId) requirementId ??= (await featureIn(projectId, input.featureId)).requirementId;
      if (requirementId) requirementId = (await resolveRequirement(projectId, requirementId)).id;
      const [idea] = await db
        .insert(s.testIdeas)
        .values({
          id: newId(),
          projectId,
          featureId: input.featureId ?? null,
          requirementId,
          text: input.text.trim(),
          origin: input.origin ?? (actor.startsWith("agent:") ? "llm" : "human"),
          createdBy: actor,
          updatedBy: actor,
        })
        .returning();
      await touch(projectId, "test_idea", idea!.id);
      return idea!;
    },

    async updateTestIdea(projectId: string, actor: string, ideaId: string, input: { status?: TestIdeaStatus; text?: string }) {
      const [idea] = await db
        .update(s.testIdeas)
        .set({ ...input, updatedBy: actor, updatedAt: nowIso() })
        .where(and(eq(s.testIdeas.id, ideaId), eq(s.testIdeas.projectId, projectId)))
        .returning();
      if (!idea) throw new TrackingError("Idea de test no encontrada", 404);
      await touch(projectId, "test_idea", ideaId);
      return idea;
    },

    async deleteTestIdea(projectId: string, ideaId: string) {
      await db.delete(s.testIdeas).where(and(eq(s.testIdeas.id, ideaId), eq(s.testIdeas.projectId, projectId)));
      await touch(projectId, "test_idea", ideaId);
    },

    /**
     * Files changed in the repository after the last report that covered them (or never reported).
     * This is what an agent still owes in its final report.
     */
    async pendingChanges(projectId: string): Promise<PendingFile[]> {
      await projectOr404(projectId);
      const rows = await db
        .select({
          id: s.fileArtifacts.id,
          path: s.fileArtifacts.path,
          changedAt: s.fileArtifacts.changedAt,
          reportedAt: s.fileArtifacts.reportedAt,
          symbols: sql<number>`(select count(*) from ${s.symbols} where ${s.symbols.fileId} = ${s.fileArtifacts.id})`,
        })
        .from(s.fileArtifacts)
        .where(
          and(
            eq(s.fileArtifacts.projectId, projectId),
            sql`${s.fileArtifacts.changedAt} is not null and (${s.fileArtifacts.reportedAt} is null or ${s.fileArtifacts.changedAt} > ${s.fileArtifacts.reportedAt})`,
          ),
        )
        .orderBy(desc(s.fileArtifacts.changedAt));
      return rows.map(({ path, changedAt, reportedAt, symbols }) => ({ path, changedAt: changedAt!, reportedAt, symbols: Number(symbols) }));
    },

    /**
     * Applies an agent's final report: features with their status, files with purpose and symbols,
     * tests, Definition of Done items and test ideas. Everything is validated before anything is
     * written, and the repo files and live clients are updated once at the end.
     */
    async submitReport(projectId: string, actor: string, report: WorkReport) {
      const project = await projectOr404(projectId);
      if (report.features.length === 0 && !report.dod?.length) throw new TrackingError("El reporte está vacío");
      for (const f of report.features) {
        await resolveRequirement(projectId, f.requirementId);
        if (f.featureId) await featureIn(projectId, f.featureId);
        if (!f.featureId && !f.name.trim()) throw new TrackingError("Cada feature necesita un nombre");
        for (const file of f.files ?? []) repoRelative(project.repoPath, file.path);
        for (const t of f.tests ?? []) repoRelative(project.repoPath, t.path);
      }
      for (const d of report.dod ?? []) {
        const [row] = await db
          .select({ id: s.dodItems.id })
          .from(s.dodItems)
          .innerJoin(s.requirements, eq(s.dodItems.requirementId, s.requirements.id))
          .where(and(eq(s.dodItems.id, d.id), eq(s.requirements.projectId, projectId)))
          .limit(1);
        if (!row) throw new TrackingError(`Criterio no encontrado: ${d.id}`, 404);
      }

      batching++;
      const counts = { features: 0, files: 0, symbols: 0, tests: 0, dod: 0, testIdeas: 0 };
      const features: { featureId: string; name: string; status: string }[] = [];
      try {
        for (const f of report.features) {
          const { feature } = await this.startFeature(projectId, actor, {
            requirementId: f.requirementId,
            featureId: f.featureId,
            name: f.name,
            description: f.description,
          });
          const status = f.status ?? "done";
          if (status !== "in_progress") await this.completeFeature(projectId, actor, feature.id, status);
          features.push({ featureId: feature.id, name: feature.name, status });
          counts.features++;
          for (const file of f.files ?? []) {
            await this.reportFile(projectId, actor, { path: file.path, purpose: file.purpose, featureIds: [feature.id] });
            counts.files++;
            for (const sym of file.symbols ?? []) {
              await this.reportSymbol(projectId, actor, { ...sym, path: file.path, source: "reported" });
              counts.symbols++;
            }
          }
          for (const t of f.tests ?? []) {
            await this.reportTest(projectId, actor, { ...t, featureId: feature.id });
            counts.tests++;
          }
        }
        for (const d of report.dod ?? []) {
          await this.updateDod(projectId, actor, d.id, { status: d.status, ...(d.evidence !== undefined ? { evidence: d.evidence } : {}) });
          counts.dod++;
        }
        for (const idea of report.testIdeas ?? []) {
          await this.addTestIdea(projectId, actor, { text: idea.text, requirementId: idea.requirementId ?? null, origin: "llm" });
          counts.testIdeas++;
        }
      } finally {
        batching--;
      }
      await touch(projectId, "report");
      const pending = await this.pendingChanges(projectId);
      return { features, counts, pending: pending.map((p) => p.path) };
    },

    snapshot: async (projectId: string) => {
      const snap = await loadSnapshot(db, projectId);
      if (!snap) throw new TrackingError("Proyecto no encontrado", 404);
      return snap;
    },
  };
}

export type Tracker = ReturnType<typeof createTracker>;
