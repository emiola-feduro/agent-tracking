/**
 * Git merge driver for `.agent-tracking` (see TRACKING_GITATTRIBUTES). Git calls it as
 * `merge-driver.ts <base> <ours> <theirs> <path>` and expects the result in <ours>, exit 0 when clean.
 *
 * - JSON data files merge entry by entry (requirements, DoD criteria, features, tests, links): two
 *   people who touched different entries, or different fields of one entry, never conflict.
 * - CONTEXT.md is generated: ours is kept and Agent Tracking writes it again after the merge.
 * - When both sides changed the same value differently, it falls back to git's own line merge with
 *   conflict markers, so the person resolves it as usual.
 */
import { mergeJson, stableJson, type JsonValue } from "@agent-tracking/core";
import { mergeFileAsText } from "@agent-tracking/git";
import { readFile, writeFile } from "node:fs/promises";

const [base, ours, theirs, path = ""] = process.argv.slice(2);
if (!base || !ours || !theirs) {
  console.error("uso: merge-driver.ts <base> <ours> <theirs> [path]");
  process.exit(2);
}

if (path.endsWith("CONTEXT.md")) process.exit(0);

const read = async (file: string): Promise<JsonValue | undefined> => {
  const text = await readFile(file, "utf8");
  // An empty base means the file was added on both sides.
  return text.trim() === "" ? undefined : (JSON.parse(text) as JsonValue);
};

let exitCode = 1;
try {
  const result = mergeJson(await read(base), await read(ours), await read(theirs));
  if (result.ok && result.value !== undefined) {
    await writeFile(ours, stableJson(result.value));
    exitCode = 0;
  } else {
    if (!result.ok) console.error(`agent-tracking: conflicto en ${path} (${result.path})`);
    exitCode = (await mergeFileAsText(ours, base, theirs)) ? 0 : 1;
  }
} catch {
  // Not JSON (a hand edit, conflict markers already there): let git's line merge decide.
  exitCode = (await mergeFileAsText(ours, base, theirs)) ? 0 : 1;
}
process.exit(exitCode);
