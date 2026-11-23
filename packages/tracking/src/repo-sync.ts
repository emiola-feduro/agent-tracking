import {
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
import { eq } from "drizzle-orm";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
 * Writes `.agent-tracking/project.json` and `CONTEXT.md` into the project's repository so that
 * collaborators get the same project when they pull. No-op without a repo path.
 */
export async function writeRepoFiles(db: Db, projectId: string): Promise<string | null> {
  const snap = await loadSnapshot(db, projectId);
  if (!snap?.project.repoPath) return null;
  const root = snap.project.repoPath;
  await writeIfChanged(join(root, PROJECT_FILE_PATH), serializeProjectFile(toProjectFile(snap)));
  await writeIfChanged(join(root, CONTEXT_FILE_PATH), buildContextMarkdown(snap));
  return join(root, PROJECT_FILE_PATH);
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
export function insertProjectFile(db: Db, file: ProjectFile, repoPath: string) {
  db.transaction((tx) => {
    tx.insert(s.projects).values({ ...file.project, repoPath }).run();
    insertChildren(tx, file, file.project.id, repoPath);
  });
}

/** Replaces a project's content with what the repository file says (after a pull, for example). */
export function replaceFromFile(db: Db, projectId: string, file: ProjectFile, repoPath: string) {
  const { id: _ignored, ...project } = file.project;
  db.transaction((tx) => {
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
  });
}
