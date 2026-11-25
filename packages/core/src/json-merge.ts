/**
 * Three-way merge of JSON values, used by the git merge driver for `.agent-tracking`. Objects merge
 * key by key, arrays of entities merge entry by entry (matched by `id`, else `path`, else `name`),
 * arrays of plain values merge as sets. A conflict is only reported when both sides changed the same
 * value in different ways.
 */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type MergeResult = { ok: true; value: JsonValue | undefined } | { ok: false; path: string };

const isObject = (v: unknown): v is Record<string, JsonValue> => typeof v === "object" && v !== null && !Array.isArray(v);

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Key that identifies an entry of an array of entities, or null for plain values. */
function entryKey(v: JsonValue): string | null {
  if (!isObject(v)) return null;
  if (typeof v.id === "string") return `id:${v.id}`;
  if (typeof v.path === "string") return `path:${v.path}`;
  if (typeof v.name === "string") return `name:${v.name}:${typeof v.kind === "string" ? v.kind : ""}`;
  return null;
}

class Conflict extends Error {
  constructor(readonly path: string) {
    super(`conflict at ${path}`);
  }
}

export type MergeOptions = {
  /** Side that wins a real conflict instead of failing the merge. */
  prefer?: "ours" | "theirs";
};

type Side = JsonValue | undefined;

/** `undefined` stands for "absent" (a missing key or entry). */
function merge(base: Side, ours: Side, theirs: Side, path: string, opts: MergeOptions): Side {
  if (equal(ours, theirs)) return ours;
  if (equal(base, ours)) return theirs;
  if (equal(base, theirs)) return ours;
  // Both changed it, differently.
  if (ours === undefined || theirs === undefined) {
    // Removed on one side, edited on the other: keep the edit, nothing is lost.
    return ours ?? theirs;
  }
  if (isObject(ours) && isObject(theirs)) {
    const b = isObject(base) ? base : {};
    const out: Record<string, JsonValue> = {};
    for (const key of new Set([...Object.keys(ours), ...Object.keys(theirs)])) {
      const value = merge(b[key], ours[key], theirs[key], `${path}.${key}`, opts);
      if (value !== undefined) out[key] = value;
    }
    return out;
  }
  if (Array.isArray(ours) && Array.isArray(theirs)) {
    const merged = mergeArrays(Array.isArray(base) ? base : [], ours, theirs, path, opts);
    if (merged) return merged;
  }
  if (opts.prefer) return opts.prefer === "ours" ? ours : theirs;
  throw new Conflict(path);
}

/** Null when the arrays cannot be merged entry by entry (mixed or nested values). */
function mergeArrays(base: JsonValue[], ours: JsonValue[], theirs: JsonValue[], path: string, opts: MergeOptions): JsonValue[] | null {
  const all = [...base, ...ours, ...theirs];
  const keyed = all.every((v) => entryKey(v) !== null);
  if (keyed) {
    const index = (list: JsonValue[]) => new Map(list.map((v) => [entryKey(v)!, v]));
    const [b, o, t] = [index(base), index(ours), index(theirs)];
    // Our order first, then the rest of theirs in their order (what we removed drops out in merge()
    // unless they edited it).
    const keys = [...o.keys(), ...[...t.keys()].filter((k) => !o.has(k))];
    const out: JsonValue[] = [];
    for (const key of keys) {
      const value = merge(b.get(key), o.get(key), t.get(key), `${path}[${key}]`, opts);
      if (value !== undefined) out.push(value);
    }
    return out;
  }
  if (all.every((v) => !isObject(v) && !Array.isArray(v))) {
    // Plain values behave like a set: keep what neither side removed, add what either side added.
    const has = (list: JsonValue[], v: JsonValue) => list.some((x) => x === v);
    const kept = ours.filter((v) => has(theirs, v) || !has(base, v));
    const added = theirs.filter((v) => !has(base, v) && !has(kept, v));
    return [...kept, ...added];
  }
  return null;
}

export function mergeJson(base: Side, ours: Side, theirs: Side, opts: MergeOptions = {}): MergeResult {
  try {
    return { ok: true, value: merge(base, ours, theirs, "$", opts) };
  } catch (e) {
    if (e instanceof Conflict) return { ok: false, path: e.path };
    throw e;
  }
}
