/** Line diff for small config files (LCS), enough to show what connecting an agent changes. */
export type DiffRow = { kind: "same" | "add" | "del"; text: string };

export function lineDiff(before: string, after: string): DiffRow[] {
  const a = before ? before.replace(/\n$/, "").split("\n") : [];
  const b = after.replace(/\n$/, "").split("\n");
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) rows.push({ kind: "same", text: a[i++]! }), j++;
    else if (j < m && (i >= n || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) rows.push({ kind: "add", text: b[j++]! });
    else rows.push({ kind: "del", text: a[i++]! });
  }
  return rows;
}

/** Keeps changed lines with a little context around them. */
export function compact(rows: DiffRow[], context = 2): (DiffRow | { kind: "gap"; text: string })[] {
  const keep = rows.map((r, i) => r.kind !== "same" || rows.slice(Math.max(0, i - context), i + context + 1).some((x) => x.kind !== "same"));
  const out: (DiffRow | { kind: "gap"; text: string })[] = [];
  rows.forEach((r, i) => {
    if (keep[i]) out.push(r);
    else if (out.at(-1)?.kind !== "gap") out.push({ kind: "gap", text: "..." });
  });
  return out;
}
