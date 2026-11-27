import { CollabError, createCollabClient, type CollabClient, type Role, type Tree, type User } from "@agent-tracking/collab";
import { joinProjectTree, splitProjectFile, toProjectFile } from "@agent-tracking/core";
import { loadSnapshot, schema as s, type Db } from "@agent-tracking/db";
import { eq } from "drizzle-orm";
import { insertProjectFile, mergeTrees, notifyRepoImport, replaceFromFile, sameTree, syncRepoFiles, withLock } from "./repo-sync";

/**
 * Sync of this installation (the desktop app or a local server) with a shared server. The shared
 * server keeps one versioned copy of each project's `.agent-tracking` tree; each machine merges its
 * own changes with what others pushed (three-way, from the last version it synced) and pushes back.
 */

/** app_settings key of the connection to the shared server. The token never leaves this machine's database. */
export const COLLAB_CONNECTION_KEY = "collab.connection";
const baseKey = (projectId: string) => `collab.project.${projectId}`;

export type CollabConnection = { url: string; token: string; user: User };
/** What this machine synced last for a project: the revision and its tree (the merge base). */
type SyncBase = { revision: number; tree: Tree };

export type RemoteSyncResult = {
  revision: number;
  role: Role;
  /** Changes from other people were applied locally. */
  pulled: boolean;
  /** Local changes were sent to the server. */
  pushed: boolean;
};

async function readSetting<T>(db: Db, key: string): Promise<T | null> {
  const row = await db.query.appSettings.findFirst({ where: eq(s.appSettings.key, key) });
  return (row?.value as T | undefined) ?? null;
}

async function writeSetting(db: Db, key: string, value: unknown) {
  const updatedAt = new Date().toISOString();
  await db.insert(s.appSettings).values({ key, value, updatedAt }).onConflictDoUpdate({ target: s.appSettings.key, set: { value, updatedAt } });
}

export const getCollabConnection = (db: Db) => readSetting<CollabConnection>(db, COLLAB_CONNECTION_KEY);
export const setCollabConnection = (db: Db, connection: CollabConnection) => writeSetting(db, COLLAB_CONNECTION_KEY, connection);

/** Forgets the connection and every project's sync base. */
export async function clearCollabConnection(db: Db) {
  const rows = await db.select({ key: s.appSettings.key }).from(s.appSettings);
  for (const { key } of rows) if (key === COLLAB_CONNECTION_KEY || key.startsWith("collab.project.")) await db.delete(s.appSettings).where(eq(s.appSettings.key, key));
}

export const getSyncBase = (db: Db, projectId: string) => readSetting<SyncBase>(db, baseKey(projectId));

/** A client for the saved connection, or null when this machine is not connected. */
export async function collabClientFor(db: Db, fetchImpl?: typeof fetch): Promise<CollabClient | null> {
  const conn = await getCollabConnection(db);
  return conn ? createCollabClient({ url: conn.url, token: conn.token, fetch: fetchImpl }) : null;
}

const toMap = (tree: Tree) => new Map(Object.entries(tree));
const toRecord = (tree: Map<string, string>): Tree => Object.fromEntries(tree);

async function localTree(db: Db, projectId: string) {
  const snap = await loadSnapshot(db, projectId);
  if (!snap) throw new CollabError("Proyecto no encontrado", 404);
  return { snap, tree: splitProjectFile(toProjectFile(snap)) };
}

/** Publishes a local project on the shared server; this person becomes its owner. */
export async function shareProject(db: Db, client: CollabClient, projectId: string): Promise<RemoteSyncResult> {
  await syncRepoFiles(db, projectId);
  return withLock(projectId, async () => {
    const { snap, tree } = await localTree(db, projectId);
    const { revision, role } = await client.share(projectId, snap.project.name, toRecord(tree));
    await writeSetting(db, baseKey(projectId), { revision, tree: toRecord(tree) } satisfies SyncBase);
    return { revision, role, pulled: false, pushed: true };
  });
}

/**
 * Brings the project in step with the shared server: merges what others pushed with the local
 * changes, applies the result here and pushes it when the server lacks something. Retries when
 * someone pushes in between. Viewers only pull.
 */
export async function syncProject(db: Db, client: CollabClient, projectId: string, maxAttempts = 3): Promise<RemoteSyncResult> {
  // First what arrived through git, so the database is the latest local truth.
  await syncRepoFiles(db, projectId);
  const result = await withLock(projectId, async () => {
    let pulled = false;
    for (let attempt = 1; ; attempt++) {
      const remote = await client.project(projectId);
      const { snap, tree: ours } = await localTree(db, projectId);
      const theirs = toMap(remote.tree);
      const base = await getSyncBase(db, projectId);
      // Without a base (first sync on this machine) the server is the truth.
      const merged = base ? mergeTrees(toMap(base.tree), ours, theirs) : theirs;
      if (!sameTree(merged, ours)) {
        const file = joinProjectTree(merged);
        if (!file.ok) throw new CollabError(`El proyecto del servidor no es válido (${file.error})`, 422);
        await replaceFromFile(db, projectId, file.file, snap.project.repoPath ?? "");
        pulled = true;
      }
      const canPush = remote.role !== "viewer";
      if (sameTree(merged, theirs) || !canPush) {
        await writeSetting(db, baseKey(projectId), { revision: remote.revision, tree: remote.tree } satisfies SyncBase);
        return { revision: remote.revision, role: remote.role, pulled, pushed: false };
      }
      try {
        const name = joinProjectTree(merged);
        const { revision } = await client.push(projectId, remote.revision, name.ok ? name.file.project.name : snap.project.name, toRecord(merged));
        await writeSetting(db, baseKey(projectId), { revision, tree: toRecord(merged) } satisfies SyncBase);
        return { revision, role: remote.role, pulled, pushed: true };
      } catch (e) {
        // Someone pushed after we read. The local data already holds what we read from the server,
        // so that version is the base: the next round merges only our changes onto theirs.
        if (!(e instanceof CollabError && e.status === 409) || attempt >= maxAttempts) throw e;
        await writeSetting(db, baseKey(projectId), { revision: remote.revision, tree: remote.tree } satisfies SyncBase);
      }
    }
  });
  if (result.pulled) {
    // Keep the repo files, CONTEXT.md and the UI current with what came from the server.
    await syncRepoFiles(db, projectId);
    notifyRepoImport(projectId);
  }
  return result;
}

/**
 * Gets a shared project on this machine: syncs it when it is already here (someone who cloned the
 * repo has the same project id) or creates it from the server's copy in `repoPath`.
 */
export async function joinProject(db: Db, client: CollabClient, projectId: string, repoPath: string): Promise<RemoteSyncResult> {
  const existing = await db.query.projects.findFirst({ where: eq(s.projects.id, projectId), columns: { id: true } });
  if (existing) return syncProject(db, client, projectId);
  const remote = await client.project(projectId);
  const file = joinProjectTree(toMap(remote.tree));
  if (!file.ok) throw new CollabError(`El proyecto del servidor no es válido (${file.error})`, 422);
  await insertProjectFile(db, file.file, repoPath);
  await writeSetting(db, baseKey(projectId), { revision: remote.revision, tree: remote.tree } satisfies SyncBase);
  await syncRepoFiles(db, projectId);
  return { revision: remote.revision, role: remote.role, pulled: true, pushed: false };
}
