import { z } from "zod";
import { PLATFORMS, SYMBOL_KINDS, TEST_IDEA_STATUSES, type ProjectSnapshot } from "./types";

/** Path of the shareable project file, relative to the repository root. */
export const PROJECT_FILE_PATH = ".agent-tracking/project.json";
export const CONTEXT_FILE_PATH = ".agent-tracking/CONTEXT.md";
export const PROJECT_FILE_VERSION = 1;

const id = z.string().min(1);

export const projectFileSchema = z.object({
  version: z.literal(PROJECT_FILE_VERSION),
  project: z.object({
    id,
    name: z.string().min(1),
    goal: z.string().default(""),
    platforms: z.array(z.enum(PLATFORMS)).default([]),
    stack: z.array(z.string()).default([]),
    databases: z.array(z.string()).default([]),
    repoUrl: z.string().nullable().default(null),
  }),
  rules: z.array(z.object({ id, text: z.string().min(1), priority: z.number().int().default(100) })).default([]),
  skills: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().default(""),
        source: z.enum(["user", "repo", "plugin", "catalog", "created"]),
        /** Relative to the repo for repo skills; informative only for machine-specific sources. */
        location: z.string().default(""),
        enabled: z.boolean().default(true),
      }),
    )
    .default([]),
  requirements: z
    .array(
      z.object({
        id,
        title: z.string().min(1),
        description: z.string().default(""),
        weight: z.number().positive().default(1),
        dod: z
          .array(
            z.object({
              id,
              criterion: z.string().min(1),
              origin: z.enum(["human", "llm"]).default("human"),
              status: z.enum(["pending", "done", "failed"]).default("pending"),
              evidence: z.string().nullable().default(null),
            }),
          )
          .default([]),
        features: z
          .array(
            z.object({
              id,
              name: z.string().min(1),
              description: z.string().default(""),
              status: z.enum(["pending", "in_progress", "done", "needs_review", "orphaned"]).default("pending"),
              agent: z.string().nullable().default(null),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  tests: z
    .array(
      z.object({
        id,
        featureId: z.string().nullable().default(null),
        requirementId: z.string().nullable().default(null),
        path: z.string(),
        name: z.string(),
        type: z.enum(["unit", "integration", "e2e", "component", "contract", "performance", "other"]).default("unit"),
        lastResult: z.enum(["unknown", "passing", "failing", "skipped"]).default("unknown"),
      }),
    )
    .default([]),
  // Added in phase 2. Optional so version 1 files written before them still parse.
  files: z
    .array(
      z.object({
        id,
        path: z.string().min(1),
        purpose: z.string().default(""),
        createdBy: z.string().default("user:local"),
        featureIds: z.array(z.string()).default([]),
        symbols: z
          .array(
            z.object({
              id,
              name: z.string().min(1),
              kind: z.enum(SYMBOL_KINDS),
              lineStart: z.number().int().nullable().default(null),
              lineEnd: z.number().int().nullable().default(null),
              purpose: z.string().default(""),
              source: z.enum(["reported", "inferred"]).default("reported"),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  testIdeas: z
    .array(
      z.object({
        id,
        featureId: z.string().nullable().default(null),
        requirementId: z.string().nullable().default(null),
        text: z.string().min(1),
        origin: z.enum(["human", "llm"]).default("human"),
        status: z.enum(TEST_IDEA_STATUSES).default("proposed"),
      }),
    )
    .default([]),
});

export type ProjectFile = z.infer<typeof projectFileSchema>;

const toRepoRelative = (location: string, repoPath: string | null) =>
  repoPath && location.startsWith(repoPath) ? location.slice(repoPath.length).replace(/^[/\\]+/, "") : location;

/** Builds the shareable file from a snapshot. Machine-specific data (repoPath, timestamps) is left out. */
export function toProjectFile(s: ProjectSnapshot): ProjectFile {
  const { project: p } = s;
  return {
    version: PROJECT_FILE_VERSION,
    project: {
      id: p.id,
      name: p.name,
      goal: p.goal,
      platforms: p.platforms,
      stack: p.stack,
      databases: p.databases,
      repoUrl: p.repoUrl,
    },
    rules: [...s.rules]
      .sort((a, b) => a.priority - b.priority)
      .map(({ id, text, priority }) => ({ id, text, priority })),
    skills: s.skills.map(({ name, description, source, location, enabled }) => ({
      name,
      description,
      source,
      location: source === "repo" ? toRepoRelative(location, p.repoPath) : location,
      enabled,
    })),
    requirements: s.requirements.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      weight: r.weight,
      dod: s.dod
        .filter((d) => d.requirementId === r.id)
        .map(({ id, criterion, origin, status, evidence }) => ({ id, criterion, origin, status, evidence })),
      features: s.features
        .filter((f) => f.requirementId === r.id)
        .map(({ id, name, description, status, agent }) => ({ id, name, description, status, agent })),
    })),
    tests: s.tests.map(({ id, featureId, requirementId, path, name, type, lastResult }) => ({
      id,
      featureId,
      requirementId,
      path,
      name,
      type,
      lastResult,
    })),
    files: s.files.map((f) => ({
      id: f.id,
      path: f.path,
      purpose: f.purpose,
      createdBy: f.createdBy,
      featureIds: s.featureFiles
        .filter((l) => l.fileId === f.id)
        .map((l) => l.featureId)
        .sort(),
      symbols: s.symbols
        .filter((y) => y.fileId === f.id)
        .map(({ id, name, kind, lineStart, lineEnd, purpose, source }) => ({
          id,
          name,
          kind,
          lineStart,
          lineEnd,
          purpose,
          source,
        })),
    })),
    testIdeas: s.testIdeas.map(({ id, featureId, requirementId, text, origin, status }) => ({
      id,
      featureId,
      requirementId,
      text,
      origin,
      status,
    })),
  };
}

export const serializeProjectFile = (file: ProjectFile) => `${JSON.stringify(file, null, 2)}\n`;

export type ParseResult = { ok: true; file: ProjectFile } | { ok: false; error: string };

export function parseProjectFile(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "El archivo no es JSON válido" };
  }
  const parsed = projectFileSchema.safeParse(raw);
  return parsed.success ? { ok: true, file: parsed.data } : { ok: false, error: z.prettifyError(parsed.error) };
}
