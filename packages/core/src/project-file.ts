import { z } from "zod";
import { PROJECT_KINDS } from "./project-kind";
import { PLATFORMS, REQUIREMENT_AREAS, REQUIREMENT_TYPES, SYMBOL_KINDS, TEST_IDEA_STATUSES, type ProjectSnapshot } from "./types";

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
    kind: z.enum(PROJECT_KINDS).default("fullstack"),
    agents: z.array(z.string()).default([]),
    commitConventions: z
      .object({
        types: z.array(z.string()),
        scope: z.enum(["optional", "required", "none"]).default("optional"),
        language: z.enum(["es", "en"]).default("es"),
        custom: z.string().default(""),
      })
      .nullable()
      .default(null),
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
        plugin: z.string().nullable().default(null),
        marketplace: z.string().nullable().default(null),
        marketplaceSource: z.string().nullable().default(null),
        /** In the repo at .agent-tracking/skills/<folder>, ready to install. */
        shared: z.boolean().default(false),
      }),
    )
    .default([]),
  requirements: z
    .array(
      z.object({
        id,
        title: z.string().min(1),
        description: z.string().default(""),
        type: z.enum(REQUIREMENT_TYPES).default("functional"),
        area: z.enum(REQUIREMENT_AREAS).default("general"),
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
  /** Image metadata; the bytes are in .agent-tracking/attachments (see attachmentRepoPath). */
  attachments: z
    .array(
      z.object({
        id,
        kind: z.enum(["reference", "screen"]).default("reference"),
        requirementId: z.string().nullable().default(null),
        dodItemId: z.string().nullable().default(null),
        featureId: z.string().nullable().default(null),
        title: z.string().default(""),
        route: z.string().default(""),
        filename: z.string().min(1),
        createdBy: z.string().default("user:local"),
        createdAt: z.string().optional(),
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
      kind: p.kind,
      agents: p.agents ?? [],
      commitConventions: p.commitConventions ?? null,
      platforms: p.platforms,
      stack: p.stack,
      databases: p.databases,
      repoUrl: p.repoUrl,
    },
    rules: [...s.rules]
      .sort((a, b) => a.priority - b.priority)
      .map(({ id, text, priority }) => ({ id, text, priority })),
    skills: s.skills.map(({ name, description, source, location, enabled, plugin, marketplace, marketplaceSource, shared }) => ({
      name,
      description,
      source,
      location: source === "repo" ? toRepoRelative(location, p.repoPath) : location,
      enabled,
      plugin: plugin ?? null,
      marketplace: marketplace ?? null,
      marketplaceSource: marketplaceSource ?? null,
      shared: shared ?? false,
    })),
    requirements: s.requirements.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      type: r.type,
      area: r.area,
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
    attachments: (s.attachments ?? []).map(({ id, kind, requirementId, dodItemId, featureId, title, route, filename, createdBy, createdAt }) => ({
      id,
      kind,
      requirementId,
      dodItemId,
      featureId,
      title,
      route,
      filename,
      createdBy,
      createdAt,
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
