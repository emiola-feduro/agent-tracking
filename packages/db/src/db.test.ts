import { Database } from "bun:sqlite";
import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSnapshot, openDb } from "./index";
import { MIGRATIONS } from "./migrations.gen";

const dirs: string[] = [];
afterAll(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

const OLD_PROJECTS = `CREATE TABLE \`projects\` (
  \`id\` text PRIMARY KEY NOT NULL, \`name\` text NOT NULL, \`goal\` text DEFAULT '' NOT NULL,
  \`app_type\` text NOT NULL, \`stack\` text DEFAULT '[]' NOT NULL, \`database\` text,
  \`repo_path\` text, \`repo_url\` text,
  \`created_by\` text DEFAULT 'user:local' NOT NULL, \`updated_by\` text DEFAULT 'user:local' NOT NULL,
  \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
  \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL)`;

/** Recreates a database as the first pre-release version left it. */
async function legacyDb() {
  const dir = await mkdtemp(join(tmpdir(), "at-db-"));
  dirs.push(dir);
  const path = join(dir, "legacy.db");
  const sqlite = new Database(path, { create: true });
  sqlite.exec(OLD_PROJECTS);
  for (const stmt of MIGRATIONS[0]!.sql.split("--> statement-breakpoint")) {
    if (stmt.includes("CREATE TABLE `projects`") || stmt.includes("projects_repo_path_unique")) continue;
    sqlite.exec(stmt);
  }
  sqlite.exec("CREATE TABLE __migrations (tag TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  sqlite.exec("INSERT INTO __migrations VALUES ('0000_init', '2026-11-23T00:00:00Z')");
  sqlite.exec(`INSERT INTO projects (id, name, app_type, database) VALUES
    ('a', 'Móvil', 'mobile', 'SQLite + Firebase'),
    ('b', 'Todo', 'multiplatform', NULL)`);
  sqlite.exec("INSERT INTO business_rules (id, project_id, text) VALUES ('r1', 'a', 'Regla')");
  sqlite.close();
  return path;
}

test("a fresh database gets the current schema", async () => {
  const db = openDb(":memory:");
  expect(await loadSnapshot(db, "missing")).toBeNull();
});

test("a pre-release database is converted in place and keeps its data", async () => {
  const path = await legacyDb();
  const db = openDb(path);
  const a = (await loadSnapshot(db, "a"))!;
  expect(a.project.platforms).toEqual(["mobile"]);
  expect(a.project.databases).toEqual(["SQLite", "Firebase"]);
  expect(a.rules.map((r) => r.text)).toEqual(["Regla"]);
  const b = (await loadSnapshot(db, "b"))!;
  expect(b.project.platforms).toEqual(["web", "desktop", "mobile"]);
  expect(b.project.databases).toEqual([]);
  // Opening again must not re-run anything.
  expect(() => openDb(path)).not.toThrow();
});
