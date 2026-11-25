import { join } from "node:path";

/** Name of the merge driver in .gitattributes and .git/config (`merge=agent-tracking`). */
export const MERGE_DRIVER_NAME = "agent-tracking";

/** Script git runs as `<bun> <script> %O %A %B %P`. */
export const MERGE_DRIVER_SCRIPT = join(import.meta.dir, "merge-driver.ts");
