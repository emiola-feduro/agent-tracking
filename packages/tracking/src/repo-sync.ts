import { AGENTS, isAgentKind } from "@agent-tracking/agents";
import {
  agentContextBlock,
  ATTACHMENTS_DIR,
  BLOCK_START,
  withManagedBlock,
  type ProjectSnapshot,
  attachmentRepoPath,
  SHARED_SKILLS_DIR,
  sharedSkillPath,
  buildContextMarkdown,
  CONTEXT_FILE_PATH,
  FILES_DIR,
  INFERRED_ACTOR,
  isTrackingDataPath,
  joinProjectTree,
  mergeJson,
  PROJECT_FILE_PATH,
  REQUIREMENTS_DIR,
  splitProjectFile,
  stableJson,
  TESTS_DIR,
  toProjectFile,
  TRACKING_DIR,
  type JsonValue,
  type ParseResult,
  type ProjectFile,
} from "@agent-tracking/core";
import { loadSnapshot, schema as s, type Db } from "@agent-tracking/db";
import { shareSkill } from "@agent-tracking/skills";
import { sniffImage } from "./attachments";
import { ensureMergeDriver } from "@agent-tracking/git";
import { and, eq, inArray } from "drizzle-orm";
import { mkdir, readdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, sep } from "node:path";
import { MERGE_DRIVER_NAME, MERGE_DRIVER_SCRIPT } from "./merge-driver-info";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function writeIfChanged(path: string, content: string) {
  const current = await readFile(path, "utf8").catch(() => null);
  if (current === content) return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  return true;
}

/**
 * Each agent's own instruction file at the repo root (CLAUDE.md, AGENTS.md, GEMINI.md) carries the
 * Agent Tracking block when that agent works on the project, and loses it when it no longer does.
 * Files that never had the block are not created or touched for agents left out.
 */
async function writeAgentFiles(root: string, snap: ProjectSnapshot) {
  const chosen = new Set((snap.project.agents ?? []).filter(isAgentKind).map((k) => AGENTS[k].contextFile));
  const block = agentContextBlock(snap);
  for (const file of new Set(Object.values(AGENTS).map((a) => a.contextFile))) {
    const path = join(root, file);
    const current = await readFile(path, "utf8").catch(() => null);
    if (!chosen.has(file) && (current === null || !current.includes(BLOCK_START))) continue;
    const next = withManagedBlock(current, chosen.has(file) ? block : null);
    // A file that only held the block goes away with it.
    if (next === "") await rm(path, { force: true });
    else if (next !== null && next !== current) await writeIfChanged(path, next);
  }
}

/** Content of `.agent-tracking/.gitattributes`: git merges the data files with Agent Tracking's driver. */
export const TRACKING_GITATTRIBUTES = `# Written by Agent Tracking. Merges these files entry by entry instead of line by line; the driver
# is registered in each clone's .git/config by Agent Tracking. Without it git merges them as text.
*.json merge=agent-tracking
CONTEXT.md merge=agent-tracking linguist-generated=true
`;

/** What Agent Tracking last wrote in each repository: the common base to tell its changes from a pull's. */
const written = new Map<string, Map<string, string>>();

/** One sync at a time per project: imports and writes never interleave. */
const locks = new Map<string, Promise<unknown>>();
const withLock = <T>(key: string, task: () => Promise<T>): Promise<T> => {
  const next = (locks.get(key) ?? Promise.resolve()).catch(() => {}).then(task);
  locks.set(key, next);
  return next;
};

type ImportListener = (projectId: string) => void;
const importListeners = new Set<ImportListener>();

/** Called after changes that arrived through git (pull, merge, checkout) were imported. */
export function onRepoImport(listener: ImportListener) {
  importListeners.add(listener);
  return () => void importListeners.delete(listener);
}

/** Reads the data files of `.agent-tracking` (repo-relative path → content). Empty without project.json. */
export async function readTrackingTree(root: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const core = await readFile(join(root, PROJECT_FILE_PATH), "utf8").catch(() => null);
  if (core === null) return out;
  out.set(PROJECT_FILE_PATH, core);
  for (const dir of [REQUIREMENTS_DIR, FILES_DIR, TESTS_DIR, ATTACHMENTS_DIR]) {
    const names = await readdir(join(root, dir), { recursive: true }).catch(() => [] as string[]);
    for (const name of names.sort()) {
      const path = `${dir}/${name.split(sep).join("/")}`;
      if (!isTrackingDataPath(path)) continue;
      const text = await readFile(join(root, path), "utf8").catch(() => null);
      if (text !== null) out.set(path, text);
    }
  }
  return out;
}

const sameTree = (a: Map<string, string>, b: Map<string, string>) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);

const asObject = (tree: Map<string, string>) => Object.fromEntries([...tree].map(([path, text]) => [path, JSON.parse(text) as JsonValue]));

/**
 * Three-way merge of the layout: `base` is what Agent Tracking wrote last, `ours` the database now,
 * `theirs` what is on disk. Where both changed the same value, the disk wins: it is what the team
 * agreed on in git.
 */
function mergeTrees(base: Map<string, string>, ours: Map<string, string>, theirs: Map<string, string>) {
  const merged = mergeJson(asObject(base), asObject(ours), asObject(theirs), { prefer: "theirs" });
  if (!merged.ok || !merged.value || typeof merged.value !== "object") return theirs;
  return new Map(Object.entries(merged.value).map(([path, value]) => [path, stableJson(value)]));
}

export type RepoSync = { status: "unchanged" | "imported" } | { status: "invalid"; error: string };

/**
 * Brings changes that reached the files through git into the database. Changes Agent Tracking made
 * itself are recognised (it remembers what it wrote) and the database's own pending changes are
 * kept by merging both sides.
 */
async function importLocked(db: Db, projectId: string, root: string): Promise<RepoSync> {
  const disk = await readTrackingTree(root);
  if (disk.size === 0) return { status: "unchanged" };
  const known = written.get(root);
  if (known && sameTree(disk, known)) return { status: "unchanged" };
  const parsed = joinProjectTree(disk);
  // Conflict markers or a half-edited file: leave everything as it is until it is fixed.
  if (!parsed.ok) return { status: "invalid", error: parsed.error };
  // Files of another project (one created again instead of imported): this one's data wins, as before.
  if (parsed.file.project.id !== projectId) return { status: "unchanged" };
  const snap = await loadSnapshot(db, projectId);
  if (!snap) return { status: "unchanged" };
  const ours = splitProjectFile(toProjectFile(snap));
  const theirs = splitProjectFile(parsed.file);
  // Without a known base (first sync since the app started) the files are the truth.
  const result = known ? mergeTrees(known, ours, theirs) : theirs;
  if (sameTree(result, ours)) return { status: "unchanged" };
  const file = joinProjectTree(result);
  if (!file.ok) return { status: "invalid", error: file.error };
  await replaceFromFile(db, projectId, file.file, root);
  return { status: "imported" };
}

async function writeLocked(db: Db, projectId: string): Promise<string | null> {
  const snap = await loadSnapshot(db, projectId);
  if (!snap?.project.repoPath) return null;
  const root = snap.project.repoPath;
  const tree = splitProjectFile(toProjectFile(snap));
  const disk = await readTrackingTree(root);
  for (const [path, content] of tree) if (disk.get(path) !== content) await writeIfChanged(join(root, path), content);
  for (const path of disk.keys()) {
    if (tree.has(path)) continue;
    await rm(join(root, path), { force: true });
    await pruneEmptyDirs(root, dirname(path));
  }
  written.set(root, tree);
  await writeIfChanged(join(root, CONTEXT_FILE_PATH), buildContextMarkdown(snap));
  await writeIfChanged(join(root, TRACKING_DIR, ".gitattributes"), TRACKING_GITATTRIBUTES);
  await registerMergeDriver(root);
  await exportAttachments(db, root, snap.attachments);
  await exportSharedSkills(root, snap.skills);
  await writeAgentFiles(root, snap);
  return join(root, PROJECT_FILE_PATH);
}

/** Removes folders left empty inside `.agent-tracking`, from `dir` up. */
async function pruneEmptyDirs(root: string, dir: string) {
  while (dir.startsWith(`${TRACKING_DIR}/`) && [REQUIREMENTS_DIR, FILES_DIR, TESTS_DIR, ATTACHMENTS_DIR].every((d) => d !== dir)) {
    const ok = await rmdir(join(root, dir)).then(() => true, () => false);
    if (!ok) return;
    dir = dirname(dir);
  }
}

const registered = new Set<string>();

/** Tells this clone's git to merge the data files with Agent Tracking's driver (local config only). */
async function registerMergeDriver(root: string) {
  if (registered.has(root)) return;
  registered.add(root);
  const quote = (v: string) => `'${v.replaceAll("'", `'\\''`)}'`;
  const command = `${quote(process.execPath)} ${quote(MERGE_DRIVER_SCRIPT)} %O %A %B %P`;
  await ensureMergeDriver(root, MERGE_DRIVER_NAME, "Agent Tracking", command).catch(() => {});
}

/**
 * Keeps the database and `.agent-tracking` in step: first imports what arrived through git, then
 * writes the database back so the files, CONTEXT.md and the agents' instruction files are current.
 * Collaborators get the same project when they pull. No-op without a repo path.
 */
export async function syncRepoFiles(db: Db, projectId: string): Promise<RepoSync & { path: string | null }> {
  const project = await db.query.projects.findFirst({ where: eq(s.projects.id, projectId), columns: { repoPath: true } });
  const root = project?.repoPath;
  if (!root) return { status: "unchanged", path: null };
  return withLock(projectId, async () => {
    const result = await importLocked(db, projectId, root);
    // Never write over files someone has to fix by hand (a merge conflict, for instance).
    if (result.status === "invalid") return { ...result, path: null };
    const path = await writeLocked(db, projectId);
    if (result.status === "imported") for (const listener of importListeners) listener(projectId);
    return { ...result, path };
  });
}

/** Writes the shareable files into the repository, importing first what arrived through git. */
export async function writeRepoFiles(db: Db, projectId: string): Promise<string | null> {
  const result = await syncRepoFiles(db, projectId);
  if (result.status === "invalid") console.error(`No se actualizó .agent-tracking (${result.error})`);
  return result.path;
}

/**
 * Copies the skills marked as shared into `.agent-tracking/skills`, so someone who clones the repo
 * can install them. Skills that live in the repo already (.claude/skills) or come from a plugin are
 * not copied: the first travel with git, the second are installed from their marketplace.
 */
async function exportSharedSkills(root: string, skills: { name: string; source: string; location: string; shared: boolean }[]) {
  const shared = skills.filter((k) => k.shared && k.source !== "repo" && k.location);
  const wanted = new Set(shared.map((k) => sharedSkillPath(k.name).slice(SHARED_SKILLS_DIR.length + 1)));
  const dir = join(root, SHARED_SKILLS_DIR);
  for (const name of await readdir(dir).catch(() => [] as string[])) {
    if (!wanted.has(name)) await rm(join(dir, name), { recursive: true, force: true });
  }
  for (const k of shared) {
    // On a machine that imported the project the original folder is not there: keep the copy as it is.
    if (!(await Bun.file(k.location).exists())) continue;
    await shareSkill(k.location, root, k.name).catch((e) => console.error(`No se pudo incluir la skill ${k.name}:`, e.message));
  }
}

type FileAttachment = ProjectFile["attachments"][number];

/** Reads the images listed in a project file from the repository; missing or invalid ones are skipped. */
async function readAttachments(repoPath: string, list: FileAttachment[]) {
  const out = new Map<string, { bytes: Buffer; mime: string }>();
  for (const a of list) {
    const bytes = await readFile(join(repoPath, attachmentRepoPath(a))).catch(() => null);
    const mime = bytes && sniffImage(bytes);
    if (bytes && mime) out.set(a.id, { bytes, mime });
  }
  return out;
}

function insertAttachments(tx: Tx, file: ProjectFile, projectId: string, bytes: Map<string, { bytes: Buffer; mime: string }>) {
  const requirementIds = new Set(file.requirements.map((r) => r.id));
  const dodIds = new Set(file.requirements.flatMap((r) => r.dod.map((d) => d.id)));
  const featureIds = new Set(file.requirements.flatMap((r) => r.features.map((f) => f.id)));
  for (const a of file.attachments) {
    const image = bytes.get(a.id);
    if (!image) continue;
    tx.insert(s.attachments)
      .values({
        id: a.id,
        projectId,
        kind: a.kind,
        requirementId: a.requirementId && requirementIds.has(a.requirementId) ? a.requirementId : null,
        dodItemId: a.dodItemId && dodIds.has(a.dodItemId) ? a.dodItemId : null,
        featureId: a.featureId && featureIds.has(a.featureId) ? a.featureId : null,
        title: a.title,
        route: a.route,
        filename: a.filename,
        mime: image.mime,
        size: image.bytes.length,
        data: image.bytes,
        createdBy: a.createdBy,
        ...(a.createdAt ? { createdAt: a.createdAt } : {}),
      })
      .run();
  }
}

/**
 * Copies the project's images into `.agent-tracking/attachments` so agents can open the ones
 * CONTEXT.md points to. The folder is owned by Agent Tracking: images removed here are removed there.
 * Each image's metadata (`<image>.json`) is written with the rest of the data files.
 */
async function exportAttachments(db: Db, root: string, list: { id: string; filename: string }[]) {
  const dir = join(root, ATTACHMENTS_DIR);
  const wanted = new Map(list.map((a) => [attachmentRepoPath(a).slice(ATTACHMENTS_DIR.length + 1), a.id]));
  const present = (await readdir(dir).catch(() => [] as string[])).filter((name) => !name.endsWith(".json"));
  for (const name of present) if (!wanted.has(name)) await rm(join(dir, name), { force: true });
  const missing = [...wanted].filter(([name]) => !present.includes(name));
  if (missing.length === 0) return;
  await mkdir(dir, { recursive: true });
  for (const [name, id] of missing) {
    const row = await db.query.attachments.findFirst({ where: eq(s.attachments.id, id), columns: { data: true } });
    if (row) await writeFile(join(dir, name), row.data);
  }
}

/** Reads the project from a repository's `.agent-tracking`. Returns null when the repo has none. */
export async function readRepoFile(repoPath: string): Promise<ParseResult | null> {
  const tree = await readTrackingTree(repoPath);
  return tree.size === 0 ? null : joinProjectTree(tree);
}

const absoluteSkillLocation = (location: string, source: string, repoPath: string) =>
  source === "repo" && location && !isAbsolute(location) ? join(repoPath, location) : location;

const newId = () => crypto.randomUUID();

/**
 * Makes the project's shared data match the file. What the analysis of the code found on this
 * machine stays (inferred files, symbols and tests, line numbers, pending changes); it is only
 * stripped of the links and descriptions the file no longer has.
 */
function applyProjectFile(tx: Tx, file: ProjectFile, projectId: string, repoPath: string, images: Map<string, { bytes: Buffer; mime: string }>) {
  const { id: _ignored, ...project } = file.project;
  // Version 1 files have no creation dates: entries already here keep theirs, new ones get dates a
  // millisecond apart, in the file's order.
  const known = new Map<string, string>();
  const requirementRows = tx.select({ id: s.requirements.id, createdAt: s.requirements.createdAt }).from(s.requirements).where(eq(s.requirements.projectId, projectId)).all();
  for (const r of requirementRows) known.set(r.id, r.createdAt);
  const ids = requirementRows.map((r) => r.id);
  if (ids.length) {
    for (const d of tx.select({ id: s.dodItems.id, createdAt: s.dodItems.createdAt }).from(s.dodItems).where(inArray(s.dodItems.requirementId, ids)).all()) known.set(d.id, d.createdAt);
    for (const f of tx.select({ id: s.features.id, createdAt: s.features.createdAt }).from(s.features).where(inArray(s.features.requirementId, ids)).all()) known.set(f.id, f.createdAt);
  }
  tx.update(s.projects).set({ ...project, updatedAt: new Date().toISOString() }).where(eq(s.projects.id, projectId)).run();
  tx.delete(s.attachments).where(eq(s.attachments.projectId, projectId)).run();
  tx.delete(s.testIdeas).where(eq(s.testIdeas.projectId, projectId)).run();
  tx.delete(s.businessRules).where(eq(s.businessRules.projectId, projectId)).run();
  tx.delete(s.projectSkills).where(eq(s.projectSkills.projectId, projectId)).run();
  // Requirements cascade to DoD items, features and the features' links to files.
  tx.delete(s.requirements).where(eq(s.requirements.projectId, projectId)).run();

  for (const r of file.rules) tx.insert(s.businessRules).values({ ...r, projectId }).run();
  for (const k of file.skills) {
    tx.insert(s.projectSkills)
      .values({ ...k, id: newId(), projectId, location: absoluteSkillLocation(k.location, k.source, repoPath) })
      .run();
  }
  const base = Date.now();
  let n = 0;
  const at = (id: string, createdAt?: string) => createdAt ?? known.get(id) ?? new Date(base + n++).toISOString();
  for (const { dod, features, ...r } of file.requirements) {
    tx.insert(s.requirements).values({ ...r, createdAt: at(r.id, r.createdAt), projectId }).run();
    for (const d of dod) tx.insert(s.dodItems).values({ ...d, createdAt: at(d.id, d.createdAt), requirementId: r.id }).run();
    for (const f of features) tx.insert(s.features).values({ ...f, createdAt: at(f.id, f.createdAt), requirementId: r.id }).run();
  }
  const requirementIds = new Set(file.requirements.map((r) => r.id));
  const featureIds = new Set(file.requirements.flatMap((r) => r.features.map((f) => f.id)));
  const ref = (id: string | null, known: Set<string>) => (id && known.has(id) ? id : null);

  // Files: matched by path, since each machine gives its own ids to what it analysed.
  const shared = new Map(file.files.map((f) => [f.path, f]));
  const fileRows = tx
    .select({ id: s.fileArtifacts.id, path: s.fileArtifacts.path, createdBy: s.fileArtifacts.createdBy })
    .from(s.fileArtifacts)
    .where(eq(s.fileArtifacts.projectId, projectId))
    .all();
  for (const row of fileRows) {
    if (shared.has(row.path)) continue;
    if (row.createdBy === INFERRED_ACTOR) {
      tx.update(s.fileArtifacts).set({ purpose: "" }).where(eq(s.fileArtifacts.id, row.id)).run();
      tx.delete(s.symbols).where(and(eq(s.symbols.fileId, row.id), eq(s.symbols.source, "reported"))).run();
    } else {
      tx.delete(s.fileArtifacts).where(eq(s.fileArtifacts.id, row.id)).run();
    }
  }
  const fileIds = new Map(fileRows.map((r) => [r.path, r.id]));
  for (const f of file.files) {
    let fileId = fileIds.get(f.path);
    if (fileId) {
      tx.update(s.fileArtifacts).set({ purpose: f.purpose, createdBy: f.createdBy }).where(eq(s.fileArtifacts.id, fileId)).run();
    } else {
      fileId = newId();
      tx.insert(s.fileArtifacts)
        .values({ id: fileId, projectId, path: f.path, purpose: f.purpose, createdBy: f.createdBy, updatedBy: f.createdBy })
        .run();
    }
    for (const featureId of f.featureIds) {
      if (featureIds.has(featureId)) tx.insert(s.featureFiles).values({ featureId, fileId, createdBy: f.createdBy }).onConflictDoNothing().run();
    }
    const keep = new Set(f.symbols.map((y) => `${y.kind}:${y.name}`));
    const symbolRows = tx
      .select({ id: s.symbols.id, name: s.symbols.name, kind: s.symbols.kind })
      .from(s.symbols)
      .where(and(eq(s.symbols.fileId, fileId), eq(s.symbols.source, "reported")))
      .all();
    for (const y of symbolRows) if (!keep.has(`${y.kind}:${y.name}`)) tx.delete(s.symbols).where(eq(s.symbols.id, y.id)).run();
    for (const y of f.symbols) {
      const lines = y.lineStart != null ? { lineStart: y.lineStart, lineEnd: y.lineEnd ?? null } : {};
      tx.insert(s.symbols)
        .values({ id: newId(), fileId, name: y.name, kind: y.kind, purpose: y.purpose, source: y.source, ...lines, createdBy: f.createdBy, updatedBy: f.createdBy })
        .onConflictDoUpdate({ target: [s.symbols.fileId, s.symbols.name, s.symbols.kind], set: { purpose: y.purpose, source: y.source, ...lines } })
        .run();
    }
  }

  // Tests: matched by path and name, for the same reason.
  const testKey = (path: string, name: string) => `${path}\0${name}`;
  const sharedTests = new Map(file.tests.map((t) => [testKey(t.path, t.name), t]));
  const testRows = tx
    .select({ id: s.tests.id, path: s.tests.path, name: s.tests.name, createdBy: s.tests.createdBy, lastResult: s.tests.lastResult })
    .from(s.tests)
    .where(eq(s.tests.projectId, projectId))
    .all();
  const testIds = new Map<string, string>();
  for (const row of testRows) {
    const key = testKey(row.path, row.name);
    if (sharedTests.has(key)) {
      testIds.set(key, row.id);
    } else if (row.createdBy === INFERRED_ACTOR) {
      const lastResult = row.lastResult === "skipped" ? "skipped" : "unknown";
      tx.update(s.tests).set({ featureId: null, requirementId: null, lastResult }).where(eq(s.tests.id, row.id)).run();
    } else {
      tx.delete(s.tests).where(eq(s.tests.id, row.id)).run();
    }
  }
  for (const [key, t] of sharedTests) {
    const values = {
      featureId: ref(t.featureId, featureIds),
      requirementId: ref(t.requirementId, requirementIds),
      type: t.type,
      lastResult: t.lastResult,
    };
    const id = testIds.get(key);
    if (id) tx.update(s.tests).set(values).where(eq(s.tests.id, id)).run();
    else tx.insert(s.tests).values({ id: newId(), projectId, path: t.path, name: t.name, ...values }).run();
  }

  for (const t of file.testIdeas) {
    tx.insert(s.testIdeas)
      .values({
        ...t,
        createdAt: at(t.id, t.createdAt),
        featureId: ref(t.featureId, featureIds),
        requirementId: ref(t.requirementId, requirementIds),
        projectId,
      })
      .run();
  }
  insertAttachments(tx, file, projectId, images);
}

/** Creates a project from a repository's project file, keeping its ids so both sides stay in sync. */
export async function insertProjectFile(db: Db, file: ProjectFile, repoPath: string) {
  const images = await readAttachments(repoPath, file.attachments);
  db.transaction((tx) => {
    tx.insert(s.projects).values({ ...file.project, repoPath }).run();
    applyProjectFile(tx, file, file.project.id, repoPath, images);
  });
}

/** Replaces a project's shared data with what the repository files say (after a pull, for example). */
export async function replaceFromFile(db: Db, projectId: string, file: ProjectFile, repoPath: string) {
  const images = await readAttachments(repoPath, file.attachments);
  // Images already stored keep their bytes even if their file is missing from this checkout.
  const stored = await db.select({ id: s.attachments.id, data: s.attachments.data, mime: s.attachments.mime }).from(s.attachments).where(eq(s.attachments.projectId, projectId));
  for (const row of stored) if (!images.has(row.id)) images.set(row.id, { bytes: row.data, mime: row.mime });
  db.transaction((tx) => applyProjectFile(tx, file, projectId, repoPath, images));
}
