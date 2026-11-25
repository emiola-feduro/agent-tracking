const norm = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * How well `query` matches `text`: whole prefix > start of a word or path segment > substring >
 * letters in order ("cretap" finds "createApp"). null when it does not match at all.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = norm(query.trim());
  if (!q) return 0;
  const t = norm(text);
  if (t.startsWith(q)) return 100 - Math.min(t.length - q.length, 40) * 0.1;
  const words = t.split(/[\s/._\-:]+|(?<=[a-z])(?=[A-Z])/);
  if (words.some((w) => w.startsWith(q))) return 80;
  // camelCase starts in the original text: "ca" matches createApp at "App".
  if (new RegExp(`(?:^|[^a-z])${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text)) return 75;
  const at = t.indexOf(q);
  if (at >= 0) return 60 - Math.min(at, 20);
  let i = 0;
  for (const ch of t) if (ch === q[i]) i++;
  return i === q.length ? 30 - Math.min(t.length - q.length, 25) : null;
}

/** The text that completes `query` when `candidate` starts with it, keeping the typed casing. */
export function completionOf(query: string, candidate: string): string | null {
  if (!query) return null;
  return norm(candidate).startsWith(norm(query)) && candidate.length > query.length ? candidate.slice(query.length) : null;
}
