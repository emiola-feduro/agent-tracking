import { schema as s, type Db } from "@agent-tracking/db";
import { watchHead, watchRepo, type RepoWatcher } from "@agent-tracking/git";
import { syncRepoFiles, type RepoInference } from "@agent-tracking/tracking";
import { eq, isNotNull } from "drizzle-orm";

/**
 * One file watcher per project with a local repository. Changes to the code are analysed in the
 * background (see `createRepoInference`); changes to `.agent-tracking` that did not come from
 * Agent Tracking itself (a pull, a merge, a checkout) are imported (see `syncRepoFiles`). Work on the
 * same project never overlaps.
 */
export function createRepoWatchers(
  db: Db,
  inference: RepoInference,
  opts: { debounceMs?: number; /** The repository switched branch. */ onBranchChange?: (projectId: string) => void } = {},
) {
  const watchers = new Map<string, { root: string; watcher: RepoWatcher; head?: RepoWatcher }>();
  const queues = new Map<string, Promise<unknown>>();

  /** Runs analyses of one project one after another. */
  const enqueue = (projectId: string, task: () => Promise<unknown>) => {
    const next = (queues.get(projectId) ?? Promise.resolve()).then(task).catch((e) => {
      console.error(`[repo] no se pudo analizar el proyecto ${projectId}:`, e instanceof Error ? e.message : e);
    });
    queues.set(projectId, next);
    return next;
  };

  const stop = (projectId: string) => {
    watchers.get(projectId)?.watcher.close();
    watchers.get(projectId)?.head?.close();
    watchers.delete(projectId);
    inference.forgetProject(projectId);
  };

  /** Starts, restarts or stops the watcher so it matches the project's current repo path. */
  const ensure = async (projectId: string) => {
    const project = await db.query.projects.findFirst({ where: eq(s.projects.id, projectId) });
    const root = project?.repoPath ?? null;
    const current = watchers.get(projectId);
    if (current && current.root === root) return;
    if (current) stop(projectId);
    if (!root) return;
    const onChange = (paths: string[]) => {
      const code = paths.filter((p) => !p.startsWith(".agent-tracking/"));
      if (code.length < paths.length) void enqueue(projectId, () => syncRepoFiles(db, projectId));
      if (code.length > 0) void enqueue(projectId, () => inference.syncPaths(projectId, code));
    };
    const watcher = watchRepo(root, onChange, {
      debounceMs: opts.debounceMs ?? 500,
      onError: (e) => console.error(`[repo] error vigilando ${root}:`, e instanceof Error ? e.message : e),
    });
    const entry: { root: string; watcher: RepoWatcher; head?: RepoWatcher } = { root, watcher };
    watchers.set(projectId, entry);
    if (opts.onBranchChange) {
      const notify = opts.onBranchChange;
      const head = await watchHead(root, () => notify(projectId)).catch(() => undefined);
      // The project may have been stopped or moved while git answered.
      if (watchers.get(projectId) === entry) entry.head = head;
      else head?.close();
    }
    // Catch up with what changed while nobody was watching: pulls first, then the code.
    await enqueue(projectId, () => syncRepoFiles(db, projectId));
    await enqueue(projectId, () => inference.syncWorkingTree(projectId));
  };

  return {
    ensure,
    stop,
    /** Analyses now, through the same queue as the watcher. */
    sync: (projectId: string, scope: "changes" | "all") =>
      enqueue(projectId, () => (scope === "all" ? inference.syncAll(projectId) : inference.syncWorkingTree(projectId))),
    async startAll() {
      const rows = await db.select({ id: s.projects.id }).from(s.projects).where(isNotNull(s.projects.repoPath));
      await Promise.all(rows.map((r) => ensure(r.id)));
      return rows.length;
    },
    closeAll() {
      for (const id of [...watchers.keys()]) stop(id);
    },
    get size() {
      return watchers.size;
    },
  };
}

export type RepoWatchers = ReturnType<typeof createRepoWatchers>;
