import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { LEGACY_UPGRADES } from "./legacy";
import { MIGRATIONS } from "./migrations.gen";
import * as schema from "./schema";

export * as schema from "./schema";
export type Db = ReturnType<typeof openDb>;

/** Aplica las migraciones embebidas que falten, cada una en su transacción. */
function migrate(sqlite: Database) {
  sqlite.exec("CREATE TABLE IF NOT EXISTS __migrations (tag TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = new Set(sqlite.query<{ tag: string }, []>("SELECT tag FROM __migrations").all().map((r) => r.tag));
  const record = sqlite.query("INSERT INTO __migrations (tag, applied_at) VALUES (?, ?)");
  for (const legacy of LEGACY_UPGRADES) {
    if (!applied.has(legacy.tag) || applied.has(legacy.replacedBy)) continue;
    sqlite.transaction(() => {
      legacy.upgrade(sqlite);
      record.run(legacy.replacedBy, new Date().toISOString());
    })();
    applied.add(legacy.replacedBy);
  }
  for (const m of MIGRATIONS) {
    if (applied.has(m.tag)) continue;
    sqlite.transaction(() => {
      for (const stmt of m.sql.split("--> statement-breakpoint")) if (stmt.trim()) sqlite.exec(stmt);
      record.run(m.tag, new Date().toISOString());
    })();
  }
}

/** Migration tags this build knows, current and legacy. */
const KNOWN_TAGS = new Set([...MIGRATIONS.map((m) => m.tag), ...LEGACY_UPGRADES.flatMap((l) => [l.tag, l.replacedBy])]);

export class DatabaseTooNewError extends Error {
  constructor() {
    super(
      "La base de datos de Agent Tracking es de una versión más nueva que este proceso. Reinícialo (por ejemplo, reinicia el agente o su servidor MCP) para no perder datos que esta versión no conoce.",
    );
    this.name = "DatabaseTooNewError";
  }
}

/**
 * Throws when the database has migrations this build does not know: a newer Agent Tracking migrated
 * it. A long-running process with older code (an agent's MCP started before an update) would
 * otherwise write rows without the new columns and erase what they hold.
 */
export function assertCurrentSchema(db: Db) {
  const tags = (db.$client as Database).query<{ tag: string }, []>("SELECT tag FROM __migrations").all();
  if (tags.some((r) => !KNOWN_TAGS.has(r.tag))) throw new DatabaseTooNewError();
}

/** Abre (o crea) la base SQLite y aplica migraciones. Usa ":memory:" en tests. */
export function openDb(path = process.env.AGENT_TRACKING_DB ?? "agent-tracking.db") {
  const sqlite = new Database(path, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  migrate(sqlite);
  return drizzle(sqlite, { schema });
}

export { loadSnapshot } from "./snapshot";
