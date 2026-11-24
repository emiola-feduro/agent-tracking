// Archivo generado por scripts/embed-migrations.ts — no editar.
import m0 from "../migrations/0000_nosy_patch.sql" with { type: "text" };
import m1 from "../migrations/0001_famous_magik.sql" with { type: "text" };
import m2 from "../migrations/0002_file_report_times.sql" with { type: "text" };

export const MIGRATIONS: { tag: string; sql: string }[] = [
  { tag: "0000_nosy_patch", sql: m0 },
  { tag: "0001_famous_magik", sql: m1 },
  { tag: "0002_file_report_times", sql: m2 },
];
