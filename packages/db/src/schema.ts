import type { Platform, SymbolKind, TestIdeaStatus } from "@agent-tracking/core";
import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;
/** Auditoría: actor = "user:<id>" | "agent:<id>". Preparado para colaboración multiusuario. */
const audit = {
  createdBy: text("created_by").notNull().default("user:local"),
  updatedBy: text("updated_by").notNull().default("user:local"),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
};

export const projects = sqliteTable("projects", {
  id: id(),
  name: text("name").notNull(),
  goal: text("goal").notNull().default(""),
  platforms: text("platforms", { mode: "json" }).$type<Platform[]>().notNull().default(sql`'[]'`),
  stack: text("stack", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  databases: text("databases", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  repoPath: text("repo_path").unique(),
  repoUrl: text("repo_url"),
  ...audit,
});

const projectRef = () =>
  text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" });

export const businessRules = sqliteTable("business_rules", {
  id: id(),
  projectId: projectRef(),
  text: text("text").notNull(),
  priority: integer("priority").notNull().default(100),
  ...audit,
});

export const projectSkills = sqliteTable("project_skills", {
  id: id(),
  projectId: projectRef(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  source: text("source", { enum: ["user", "repo", "plugin", "catalog", "created"] }).notNull(),
  location: text("location").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  ...audit,
});

export const requirements = sqliteTable("requirements", {
  id: id(),
  projectId: projectRef(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  weight: real("weight").notNull().default(1),
  ...audit,
});

const requirementRef = () => text("requirement_id").references(() => requirements.id, { onDelete: "cascade" });

export const dodItems = sqliteTable("dod_items", {
  id: id(),
  requirementId: requirementRef().notNull(),
  criterion: text("criterion").notNull(),
  origin: text("origin", { enum: ["human", "llm"] }).notNull().default("human"),
  status: text("status", { enum: ["pending", "done", "failed"] }).notNull().default("pending"),
  evidence: text("evidence"),
  ...audit,
});

export const features = sqliteTable("features", {
  id: id(),
  requirementId: requirementRef().notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status", { enum: ["pending", "in_progress", "done", "needs_review", "orphaned"] })
    .notNull()
    .default("pending"),
  agent: text("agent"),
  ...audit,
});

export const tests = sqliteTable("tests", {
  id: id(),
  projectId: projectRef(),
  featureId: text("feature_id").references(() => features.id, { onDelete: "set null" }),
  requirementId: text("requirement_id").references(() => requirements.id, { onDelete: "set null" }),
  path: text("path").notNull(),
  name: text("name").notNull(),
  type: text("type", { enum: ["unit", "integration", "e2e", "component", "contract", "performance", "other"] })
    .notNull()
    .default("unit"),
  lastResult: text("last_result", { enum: ["unknown", "passing", "failing", "skipped"] })
    .notNull()
    .default("unknown"),
  ...audit,
});

/** A file in the project's repository that an agent created or touched, with its purpose. */
export const fileArtifacts = sqliteTable(
  "file_artifacts",
  {
    id: id(),
    projectId: projectRef(),
    /** Relative to the repository root, always with forward slashes. */
    path: text("path").notNull(),
    purpose: text("purpose").notNull().default(""),
    /** Last time repository analysis saw the file change. */
    changedAt: text("changed_at"),
    /** Last time an agent's report covered the file. Pending when changedAt is later. */
    reportedAt: text("reported_at"),
    ...audit,
  },
  (t) => [uniqueIndex("file_artifacts_project_path_unique").on(t.projectId, t.path)],
);

/** A file can serve several features and a feature spans several files. */
export const featureFiles = sqliteTable(
  "feature_files",
  {
    featureId: text("feature_id")
      .notNull()
      .references(() => features.id, { onDelete: "cascade" }),
    fileId: text("file_id")
      .notNull()
      .references(() => fileArtifacts.id, { onDelete: "cascade" }),
    createdBy: audit.createdBy,
    createdAt: audit.createdAt,
  },
  (t) => [primaryKey({ columns: [t.featureId, t.fileId] }), index("feature_files_file_idx").on(t.fileId)],
);

export const symbols = sqliteTable(
  "symbols",
  {
    id: id(),
    fileId: text("file_id")
      .notNull()
      .references(() => fileArtifacts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["function", "class", "variable", "type", "constant"] }).$type<SymbolKind>().notNull(),
    lineStart: integer("line_start"),
    lineEnd: integer("line_end"),
    purpose: text("purpose").notNull().default(""),
    /** `reported` by an agent through MCP, or `inferred` by repository analysis. */
    source: text("source", { enum: ["reported", "inferred"] }).notNull().default("reported"),
    ...audit,
  },
  (t) => [uniqueIndex("symbols_file_name_kind_unique").on(t.fileId, t.name, t.kind)],
);

/** Append-only log of what agents did, for the live activity timeline. */
export const agentEvents = sqliteTable(
  "agent_events",
  {
    id: id(),
    projectId: projectRef(),
    actor: text("actor").notNull(),
    type: text("type").notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull().default(sql`'{}'`),
    createdAt: audit.createdAt,
  },
  (t) => [index("agent_events_project_created_idx").on(t.projectId, t.createdAt)],
);

export const testIdeas = sqliteTable("test_ideas", {
  id: id(),
  projectId: projectRef(),
  featureId: text("feature_id").references(() => features.id, { onDelete: "set null" }),
  requirementId: text("requirement_id").references(() => requirements.id, { onDelete: "set null" }),
  text: text("text").notNull(),
  origin: text("origin", { enum: ["human", "llm"] }).notNull().default("human"),
  status: text("status", { enum: ["proposed", "accepted", "implemented", "discarded"] })
    .$type<TestIdeaStatus>()
    .notNull()
    .default("proposed"),
  ...audit,
});
