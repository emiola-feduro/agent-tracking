import { z } from "zod";
import { parseProjectFile, projectFileSchema, PROJECT_FILE_PATH, PROJECT_FILE_VERSION, type ParseResult, type ProjectFile } from "./project-file";
import { attachmentRepoPath } from "./requirements";

/**
 * Layout of the shared data in the repository (version 2). One file per requirement (with its DoD and
 * features), per code file and per test file, so two people working on different things never edit
 * the same file, and git merges them without conflicts:
 *
 *   .agent-tracking/project.json                     project, rules, skills, test ideas
 *   .agent-tracking/requirements/<id>.json           requirement + DoD + features
 *   .agent-tracking/files/<path>.json                what the team knows about a code file
 *   .agent-tracking/tests/<path>.json                tests of a test file that carry links or results
 *   .agent-tracking/attachments/<image>.json         metadata of an image (next to the image)
 *
 * Paths below are relative to the repository root.
 */
export const TRACKING_DIR = ".agent-tracking";
export const REQUIREMENTS_DIR = `${TRACKING_DIR}/requirements`;
export const FILES_DIR = `${TRACKING_DIR}/files`;
export const TESTS_DIR = `${TRACKING_DIR}/tests`;
const ATTACHMENT_META = /^\.agent-tracking\/attachments\/[^/]+\.json$/;

/** Data files of the layout: what Agent Tracking reads back and may remove when an entry goes away. */
export const isTrackingDataPath = (path: string) =>
  path === PROJECT_FILE_PATH ||
  (path.endsWith(".json") && [REQUIREMENTS_DIR, FILES_DIR, TESTS_DIR].some((dir) => path.startsWith(`${dir}/`))) ||
  ATTACHMENT_META.test(path);

/** Plain code-point order: the same on every machine, whatever its locale. */
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export const stableJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const byCreation = <T extends { createdAt?: string; id?: string }>(a: T, b: T) =>
  cmp(a.createdAt ?? "", b.createdAt ?? "") || cmp(a.id ?? "", b.id ?? "");

type TestEntry = Omit<ProjectFile["tests"][number], "path" | "id">;

/** Splits a project file into the files of the layout, keyed by repo-relative path. */
export function splitProjectFile(file: ProjectFile): Map<string, string> {
  const out = new Map<string, string>();
  const { requirements, files, tests, attachments, ...core } = file;
  // Entries are ordered by creation, then id, so every machine writes the same bytes.
  out.set(PROJECT_FILE_PATH, stableJson({ ...core, version: PROJECT_FILE_VERSION, testIdeas: [...core.testIdeas].sort(byCreation) }));
  for (const r of requirements) {
    out.set(`${REQUIREMENTS_DIR}/${r.id}.json`, stableJson({ ...r, dod: [...r.dod].sort(byCreation), features: [...r.features].sort(byCreation) }));
  }
  for (const f of files) out.set(`${FILES_DIR}/${f.path}.json`, stableJson(f));
  const byPath = new Map<string, TestEntry[]>();
  for (const { path, id: _id, ...t } of tests) byPath.set(path, [...(byPath.get(path) ?? []), t]);
  for (const [path, list] of byPath) {
    out.set(`${TESTS_DIR}/${path}.json`, stableJson({ path, tests: [...list].sort((a, b) => cmp(a.name, b.name)) }));
  }
  for (const a of attachments) out.set(`${attachmentRepoPath(a)}.json`, stableJson(a));
  return out;
}

const testFileSchema = z.object({ path: z.string().min(1), tests: z.array(z.record(z.string(), z.unknown())) });

/**
 * Puts the layout back together from its files (repo-relative path → content). A version 1
 * project.json is read as it is: it holds everything.
 */
export function joinProjectTree(entries: Map<string, string>): ParseResult {
  const coreText = entries.get(PROJECT_FILE_PATH);
  if (coreText === undefined) return { ok: false, error: `Falta ${PROJECT_FILE_PATH}` };
  const parse = (path: string, text: string): unknown => {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${path}: el archivo no es JSON válido`);
    }
  };
  try {
    const core = parse(PROJECT_FILE_PATH, coreText) as Record<string, unknown>;
    if (core?.version === 1) return parseProjectFile(coreText);
    const requirements: Record<string, unknown>[] = [];
    const files: Record<string, unknown>[] = [];
    const tests: Record<string, unknown>[] = [];
    const attachments: Record<string, unknown>[] = [];
    for (const [path, text] of entries) {
      if (path === PROJECT_FILE_PATH || !isTrackingDataPath(path)) continue;
      const value = parse(path, text) as Record<string, unknown>;
      if (path.startsWith(`${REQUIREMENTS_DIR}/`)) requirements.push(value);
      else if (path.startsWith(`${FILES_DIR}/`)) files.push(value);
      else if (path.startsWith(`${TESTS_DIR}/`)) {
        const group = testFileSchema.safeParse(value);
        if (!group.success) return { ok: false, error: `${path}: formato de tests inválido` };
        for (const t of group.data.tests) tests.push({ ...t, path: group.data.path });
      } else attachments.push(value);
    }
    const parsed = projectFileSchema.safeParse({
      ...core,
      requirements: requirements.sort(byCreation),
      files: files.sort((a, b) => cmp(String(a.path), String(b.path))),
      tests: tests.sort((a, b) => cmp(String(a.path), String(b.path)) || cmp(String(a.name), String(b.name))),
      attachments: attachments.sort(byCreation),
    });
    if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) };
    const file = parsed.data;
    for (const r of file.requirements) {
      r.dod.sort(byCreation);
      r.features.sort(byCreation);
    }
    file.testIdeas.sort(byCreation);
    return { ok: true, file };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
