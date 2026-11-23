// Genera src/migrations.gen.ts con las migraciones SQL embebidas, para que el binario
// compilado (`bun build --compile`, sidecar de Tauri) no dependa de archivos en disco.
import { join } from "node:path";

const dir = join(import.meta.dir, "..", "migrations");
const journal = await Bun.file(join(dir, "meta", "_journal.json")).json();
const entries: { tag: string }[] = journal.entries;
const lines = [
  "// Archivo generado por scripts/embed-migrations.ts — no editar.",
  ...entries.map((e, i) => `import m${i} from "../migrations/${e.tag}.sql" with { type: "text" };`),
  "",
  "export const MIGRATIONS: { tag: string; sql: string }[] = [",
  ...entries.map((e, i) => `  { tag: ${JSON.stringify(e.tag)}, sql: m${i} },`),
  "];",
  "",
];
await Bun.write(join(import.meta.dir, "..", "src", "migrations.gen.ts"), lines.join("\n"));
console.log(`Embebidas ${entries.length} migraciones`);
