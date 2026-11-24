/** A unified diff split per file, each with its lines classified for display. */
export type DiffLine = { kind: "add" | "del" | "ctx" | "hunk" | "meta"; text: string; oldNo?: number; newNo?: number };
export type ParsedFile = { path: string; lines: DiffLine[]; binary: boolean };

export function parsePatch(patch: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  let file: ParsedFile | null = null;
  let oldNo = 0;
  let newNo = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const m = / b\/(.+)$/.exec(line);
      file = { path: m?.[1] ?? line.slice(11), lines: [], binary: false };
      files.push(file);
      continue;
    }
    if (!file) continue;
    if (line.startsWith("+++ ")) {
      const path = line.slice(4).replace(/^b\//, "");
      if (path !== "/dev/null") file.path = path;
      continue;
    }
    if (line.startsWith("--- ") || line.startsWith("index ") || /^(new|deleted) file mode|^similarity|^rename (from|to)|^old mode|^new mode/.test(line)) continue;
    if (line.startsWith("Binary files")) {
      file.binary = true;
      continue;
    }
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(line);
    if (hunk) {
      oldNo = Number(hunk[1]);
      newNo = Number(hunk[2]);
      file.lines.push({ kind: "hunk", text: hunk[3]?.trim() ?? "" });
    } else if (line.startsWith("+")) file.lines.push({ kind: "add", text: line.slice(1), newNo: newNo++ });
    else if (line.startsWith("-")) file.lines.push({ kind: "del", text: line.slice(1), oldNo: oldNo++ });
    else if (line.startsWith(" ")) file.lines.push({ kind: "ctx", text: line.slice(1), oldNo: oldNo++, newNo: newNo++ });
    else if (line.startsWith("\\")) file.lines.push({ kind: "meta", text: line.slice(2) });
  }
  return files;
}
