import { analyzeFile, AnalysisCache, detectLanguage, type CodeSymbol, type FileAnalysis } from "@agent-tracking/analyzer";
import { INFERRED_ACTOR, type SymbolKind, type TestType } from "@agent-tracking/core";
import { schema as s, type Db } from "@agent-tracking/db";
import { listRepoFiles, workingTreeChanges } from "@agent-tracking/git";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { Tracker } from "./tracker";

export { INFERRED_ACTOR };

/** Files Agent Tracking writes itself; analysing them would loop on every change. */
const OWN_FILES = /^\.agent-tracking\//;

const KIND: Record<CodeSymbol["kind"], SymbolKind | null> = {
  function: "function",
  class: "class",
  variable: "variable",
  constant: "constant",
  type: "type",
  interface: "type",
  enum: "type",
  method: null, // shown through their class
};

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

export type InferenceResult = { analyzed: number; removed: number };

/**
 * Keeps files, symbols and tests in sync with the code in the repository. This is the live layer:
 * it shows what is changing while an agent works, without attributing it to features. The agent's
 * final report (`submitReport`) organises the work by requirement and feature. Inferred rows never
 * overwrite what an agent reported (purpose, source, test type or result); they only fill gaps.
 */
export function createRepoInference(db: Db, tracker: Tracker) {
  const caches = new Map<string, AnalysisCache>();
  const cacheFor = (projectId: string) => {
    let cache = caches.get(projectId);
    if (!cache) caches.set(projectId, (cache = new AnalysisCache()));
    return cache;
  };

  const fileRow = async (projectId: string, path: string) =>
    db.query.fileArtifacts.findFirst({ where: and(eq(s.fileArtifacts.projectId, projectId), eq(s.fileArtifacts.path, path)) });

  /**
   * Registers the file and when it last changed. The file's own modification time is used (not
   * "now"), so a report sent right after the last edit is never older than the change it covers.
   */
  const upsertFile = async (projectId: string, path: string, changedAt: string) => {
    const existing = await fileRow(projectId, path);
    if (existing) {
      if (existing.changedAt === changedAt) return existing;
      const [row] = await db.update(s.fileArtifacts).set({ changedAt }).where(eq(s.fileArtifacts.id, existing.id)).returning();
      return row!;
    }
    const [row] = await db
      .insert(s.fileArtifacts)
      .values({ id: newId(), projectId, path, changedAt, createdBy: INFERRED_ACTOR, updatedBy: INFERRED_ACTOR })
      .returning();
    return row!;
  };

  const insertQuiet = async (projectId: string, path: string) => {
    const [row] = await db
      .insert(s.fileArtifacts)
      .values({ id: newId(), projectId, path, createdBy: INFERRED_ACTOR, updatedBy: INFERRED_ACTOR })
      .returning();
    return row!;
  };

  const syncSymbols = async (fileId: string, analysis: FileAnalysis) => {
    // In test files only the tests matter; their helpers and fixtures would be noise.
    const found = (analysis.testKind ? [] : analysis.symbols)
      .map((sym) => ({ sym, kind: KIND[sym.kind] }))
      .filter((x): x is { sym: CodeSymbol; kind: SymbolKind } => x.kind !== null);
    for (const { sym, kind } of found) {
      await db
        .insert(s.symbols)
        .values({
          id: newId(),
          fileId,
          name: sym.name,
          kind,
          lineStart: sym.startLine,
          lineEnd: sym.endLine,
          source: "inferred",
          createdBy: INFERRED_ACTOR,
          updatedBy: INFERRED_ACTOR,
        })
        // Reported symbols keep their source and purpose; only the lines follow the code.
        .onConflictDoUpdate({
          target: [s.symbols.fileId, s.symbols.name, s.symbols.kind],
          set: { lineStart: sym.startLine, lineEnd: sym.endLine, updatedAt: nowIso() },
        });
    }
    const keep = found.map(({ sym, kind }) => `${kind}:${sym.name}`);
    const inferred = await db
      .select({ id: s.symbols.id, name: s.symbols.name, kind: s.symbols.kind })
      .from(s.symbols)
      .where(and(eq(s.symbols.fileId, fileId), eq(s.symbols.source, "inferred")));
    const gone = inferred.filter((r) => !keep.includes(`${r.kind}:${r.name}`)).map((r) => r.id);
    if (gone.length) await db.delete(s.symbols).where(inArray(s.symbols.id, gone));
  };

  const syncTests = async (projectId: string, path: string, analysis: FileAnalysis | null) => {
    const found = analysis?.tests ?? [];
    for (const test of found) {
      const existing = await db.query.tests.findFirst({
        where: and(eq(s.tests.projectId, projectId), eq(s.tests.path, path), eq(s.tests.name, test.name)),
      });
      if (existing) continue; // reported or already inferred: keep its type, result and links
      await db.insert(s.tests).values({
        id: newId(),
        projectId,
        path,
        name: test.name,
        type: test.kind as TestType,
        lastResult: test.skipped ? "skipped" : "unknown",
        createdBy: INFERRED_ACTOR,
        updatedBy: INFERRED_ACTOR,
      });
    }
    const names = found.map((t) => t.name);
    const stale = and(
      eq(s.tests.projectId, projectId),
      eq(s.tests.path, path),
      eq(s.tests.createdBy, INFERRED_ACTOR),
      ...(names.length ? [notInArray(s.tests.name, names)] : []),
    );
    await db.delete(s.tests).where(stale);
  };

  /** A deleted file loses what analysis added; what an agent reported stays for the record. */
  const forgetFile = async (projectId: string, path: string) => {
    const file = await fileRow(projectId, path);
    await syncTests(projectId, path, null);
    if (!file) return false;
    await db.delete(s.symbols).where(and(eq(s.symbols.fileId, file.id), eq(s.symbols.source, "inferred")));
    const reported = await db.query.symbols.findFirst({ where: eq(s.symbols.fileId, file.id) });
    if (file.createdBy === INFERRED_ACTOR && !reported) {
      await db.delete(s.fileArtifacts).where(eq(s.fileArtifacts.id, file.id));
      return true;
    }
    return false;
  };

  return {
    /**
     * Analyses changed paths (repo-relative) of a project. Supported source files are registered with
     * their symbols and tests; `markChanged: false` (full scans) records them without making them
     * pending for the next report.
     */
    async syncPaths(projectId: string, paths: string[], opts: { markChanged?: boolean } = {}): Promise<InferenceResult> {
      const project = await tracker.projectOr404(projectId);
      const root = project.repoPath;
      if (!root) return { analyzed: 0, removed: 0 };
      const relevant = [...new Set(paths)].filter((p) => !OWN_FILES.test(p) && detectLanguage(p));
      if (relevant.length === 0) return { analyzed: 0, removed: 0 };

      const cache = cacheFor(projectId);
      let analyzed = 0;
      let removed = 0;
      for (const path of relevant) {
        if (!existsSync(join(root, path))) {
          cache.delete(path);
          if (await forgetFile(projectId, path)) removed++;
          continue;
        }
        let analysis: FileAnalysis | null;
        try {
          analysis = await analyzeFile(root, path, cache);
        } catch {
          continue; // too large, unreadable or outside the repo
        }
        if (!analysis) continue;
        const existing = await fileRow(projectId, path);
        const mtime = (await stat(join(root, path))).mtime.toISOString();
        // A full scan of untouched code must not make it look like fresh, unreported work.
        const changedAt = opts.markChanged === false ? (existing?.changedAt ?? null) : mtime;
        const file = changedAt ? await upsertFile(projectId, path, changedAt) : (existing ?? (await insertQuiet(projectId, path)));
        await syncSymbols(file.id, analysis);
        await syncTests(projectId, path, analysis);
        analyzed++;
      }
      if (analyzed || removed) {
        await tracker.recordEvent(projectId, INFERRED_ACTOR, "repo_changed", {
          paths: relevant.slice(0, 20),
          analyzed,
          removed,
        });
        await tracker.touch(projectId, "repo");
      }
      return { analyzed, removed };
    },

    /** Uncommitted changes: what an agent is working on right now. */
    async syncWorkingTree(projectId: string) {
      const project = await tracker.projectOr404(projectId);
      if (!project.repoPath) return { analyzed: 0, removed: 0 };
      const changes = await workingTreeChanges(project.repoPath);
      return this.syncPaths(
        projectId,
        changes.flatMap((c) => (c.oldPath ? [c.path, c.oldPath] : [c.path])),
      );
    },

    /** Every source file in the repository, as a map of the code; nothing becomes pending. */
    async syncAll(projectId: string) {
      const project = await tracker.projectOr404(projectId);
      if (!project.repoPath) return { analyzed: 0, removed: 0 };
      return this.syncPaths(projectId, await listRepoFiles(project.repoPath), { markChanged: false });
    },

    forgetProject(projectId: string) {
      caches.delete(projectId);
    },
  };
}

export type RepoInference = ReturnType<typeof createRepoInference>;
