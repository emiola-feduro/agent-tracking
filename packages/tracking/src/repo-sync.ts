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
  parseProjectFile,
  PROJECT_FILE_PATH,
  serializeProjectFile,
  toProjectFile,
  type ParseResult,
  type ProjectFile,
} from "@agent-tracking/core";
import { loadSnapshot, schema as s, type Db } from "@agent-tracking/db";
import { shareSkill } from "@agent-tracking/skills";
import { sniffImage } from "./attachments";
import { eq } from "drizzle-orm";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";

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

/**
 * Writes `.agent-tracking/project.json` and `CONTEXT.md` into the project's repository so that
 * collaborators get the same project when they pull. No-op without a repo path.
 */
export async function writeRepoFiles(db: Db, projectId: string): Promise<string | null> {
  const snap = await loadSnapshot(db, projectId);
  if (!snap?.project.repoPath) return null;
  const root = snap.project.repoPath;
  await writeIfChanged(join(root, PROJECT_FILE_PATH), serializeProjectFile(toProjectFile(snap)));
  await writeIfChanged(join(root, CONTEXT_FILE_PATH), buildContextMarkdown(snap));
  await exportAttachments(db, root, snap.attachments);
  await exportSharedSkills(root, snap.skills);
  await writeAgentFiles(root, snap);
  return join(root, PROJECT_FILE_PATH);
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
 */
async function exportAttachments(db: Db, root: string, list: { id: string; filename: string }[]) {
  const dir = join(root, ATTACHMENTS_DIR);
  const wanted = new Map(list.map((a) => [attachmentRepoPath(a).slice(ATTACHMENTS_DIR.length + 1), a.id]));
  const present = await readdir(dir).catch(() => [] as string[]);
  for (const name of present) if (!wanted.has(name)) await rm(join(dir, name), { force: true });
  const missing = [...wanted].filter(([name]) => !present.includes(name));
  if (missing.length === 0) return;
  await mkdir(dir, { recursive: true });
  for (const [name, id] of missing) {
    const row = await db.query.attachments.findFirst({ where: eq(s.attachments.id, id), columns: { data: true } });
    if (row) await writeFile(join(dir, name), row.data);
  }
}

/** Reads the project file from a repository. Returns null when the repo has none. */
export async function readRepoFile(repoPath: string): Promise<ParseResult | null> {
  const text = await readFile(join(repoPath, PROJECT_FILE_PATH), "utf8").catch(() => null);
  return text === null ? null : parseProjectFile(text);
}

const absoluteSkillLocation = (location: string, source: string, repoPath: string) =>
  source === "repo" && location && !isAbsolute(location) ? join(repoPath, location) : location;

function insertChildren(tx: Tx, file: ProjectFile, projectId: string, repoPath: string) {
  for (const r of file.rules) tx.insert(s.businessRules).values({ ...r, projectId }).run();
  for (const k of file.skills) {
    tx.insert(s.projectSkills)
      .values({ ...k, id: crypto.randomUUID(), projectId, location: absoluteSkillLocation(k.location, k.source, repoPath) })
      .run();
  }
  for (const { dod, features, ...r } of file.requirements) {
    tx.insert(s.requirements).values({ ...r, projectId }).run();
    for (const d of dod) tx.insert(s.dodItems).values({ ...d, requirementId: r.id }).run();
    for (const f of features) tx.insert(s.features).values({ ...f, requirementId: r.id }).run();
  }
  for (const t of file.tests) tx.insert(s.tests).values({ ...t, projectId }).run();
  const featureIds = new Set(file.requirements.flatMap((r) => r.features.map((f) => f.id)));
  for (const { featureIds: links, symbols, ...f } of file.files) {
    tx.insert(s.fileArtifacts).values({ ...f, projectId, updatedBy: f.createdBy }).run();
    for (const featureId of links) {
      if (featureIds.has(featureId)) tx.insert(s.featureFiles).values({ featureId, fileId: f.id, createdBy: f.createdBy }).run();
    }
    for (const y of symbols) tx.insert(s.symbols).values({ ...y, fileId: f.id }).run();
  }
  for (const t of file.testIdeas) tx.insert(s.testIdeas).values({ ...t, projectId }).run();
}

/** Creates a project from a repository's project file, keeping its ids so both sides stay in sync. */
export async function insertProjectFile(db: Db, file: ProjectFile, repoPath: string) {
  const images = await readAttachments(repoPath, file.attachments);
  db.transaction((tx) => {
    tx.insert(s.projects).values({ ...file.project, repoPath }).run();
    insertChildren(tx, file, file.project.id, repoPath);
    insertAttachments(tx, file, file.project.id, images);
  });
}

/** Replaces a project's content with what the repository file says (after a pull, for example). */
export async function replaceFromFile(db: Db, projectId: string, file: ProjectFile, repoPath: string) {
  const { id: _ignored, ...project } = file.project;
  const images = await readAttachments(repoPath, file.attachments);
  // Images already stored keep their bytes even if their file is missing from this checkout.
  const stored = await db.select({ id: s.attachments.id, data: s.attachments.data, mime: s.attachments.mime }).from(s.attachments).where(eq(s.attachments.projectId, projectId));
  for (const row of stored) if (!images.has(row.id)) images.set(row.id, { bytes: row.data, mime: row.mime });
  db.transaction((tx) => {
    tx.delete(s.attachments).where(eq(s.attachments.projectId, projectId)).run();
    tx.update(s.projects).set({ ...project, updatedAt: new Date().toISOString() }).where(eq(s.projects.id, projectId)).run();
    // Requirements cascade to DoD items and features.
    tx.delete(s.tests).where(eq(s.tests.projectId, projectId)).run();
    tx.delete(s.testIdeas).where(eq(s.testIdeas.projectId, projectId)).run();
    // Files cascade to their feature links and symbols.
    tx.delete(s.fileArtifacts).where(eq(s.fileArtifacts.projectId, projectId)).run();
    tx.delete(s.requirements).where(eq(s.requirements.projectId, projectId)).run();
    tx.delete(s.businessRules).where(eq(s.businessRules.projectId, projectId)).run();
    tx.delete(s.projectSkills).where(eq(s.projectSkills.projectId, projectId)).run();
    insertChildren(tx, file, projectId, repoPath);
    insertAttachments(tx, file, projectId, images);
  });
}
