import type { Database } from "bun:sqlite";

/**
 * Databases created before the baseline migration was regenerated recorded `0000_init`
 * (single `app_type` and `database` columns). This converts them in place to the current
 * baseline instead of re-running its CREATE TABLE statements.
 */
export const LEGACY_UPGRADES: { tag: string; replacedBy: string; upgrade: (sqlite: Database) => void }[] = [
  {
    tag: "0000_init",
    replacedBy: "0000_nosy_patch",
    upgrade: (sqlite) => {
      sqlite.exec("ALTER TABLE `projects` ADD `platforms` text DEFAULT '[]' NOT NULL");
      sqlite.exec("ALTER TABLE `projects` ADD `databases` text DEFAULT '[]' NOT NULL");

      const rows = sqlite
        .query<{ id: string; app_type: string; database: string | null }, []>("SELECT id, app_type, database FROM projects")
        .all();
      const update = sqlite.query("UPDATE projects SET platforms = ?, databases = ? WHERE id = ?");
      for (const { id, app_type, database } of rows) {
        const platforms = app_type === "multiplatform" ? ["web", "desktop", "mobile"] : [app_type];
        // "SQLite + Firebase" or "PostgreSQL, Redis" become separate entries.
        const databases = (database ?? "").split(/\s*[+,]\s*/).map((d) => d.trim()).filter(Boolean);
        update.run(JSON.stringify(platforms), JSON.stringify(databases), id);
      }

      sqlite.exec("ALTER TABLE `projects` DROP COLUMN `app_type`");
      sqlite.exec("ALTER TABLE `projects` DROP COLUMN `database`");
      sqlite.exec("CREATE UNIQUE INDEX `projects_repo_path_unique` ON `projects` (`repo_path`)");
    },
  },
];
