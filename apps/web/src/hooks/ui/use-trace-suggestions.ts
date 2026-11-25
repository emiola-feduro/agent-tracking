import { useMemo } from "react";
import type { Suggestion } from "@/components/ui/suggest-input/suggest-input";
import { isPending } from "@/hooks/data/use-traceability";
import type { ProjectView } from "@/lib/api";
import { fuzzyScore } from "@/lib/fuzzy";
import { SYMBOL_KIND_LABEL } from "@/lib/labels";

const base = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/**
 * Files and symbols that exist in the project, ranked against what is typed. With nothing typed:
 * the files changed most recently and the ones with the most functions and types.
 */
const useTraceSuggestions = (view: ProjectView, query: string): Suggestion[] => {
  const { files, symbols } = view;
  return useMemo(() => {
    const fileById = new Map(files.map((f) => [f.id, f]));
    const q = query.trim();
    if (!q) {
      const recent = files
        .filter((f) => f.changedAt)
        .sort((a, b) => (b.changedAt ?? "").localeCompare(a.changedAt ?? ""))
        .slice(0, 4)
        .map((f) => ({ value: base(f.path), label: f.path, kind: isPending(f) ? "Sin reportar" : "Cambió hace poco" }));
      const counts = new Map<string, number>();
      for (const s of symbols) counts.set(s.fileId, (counts.get(s.fileId) ?? 0) + 1);
      const busy = [...counts]
        .sort((a, b) => b[1] - a[1])
        .map(([id, n]) => ({ f: fileById.get(id), n }))
        .filter((x) => x.f && !recent.some((r) => r.label === x.f!.path))
        .slice(0, 4)
        .map(({ f, n }) => ({ value: base(f!.path), label: f!.path, kind: `${n} símbolos` }));
      return [...recent, ...busy];
    }
    const scored: (Suggestion & { score: number })[] = [];
    for (const f of files) {
      const score = Math.max(fuzzyScore(q, base(f.path)) ?? -1, (fuzzyScore(q, f.path) ?? -1) - 5);
      if (score >= 0) scored.push({ value: q.includes("/") ? f.path : base(f.path), label: f.path, kind: "Archivo", score: score + 2 });
    }
    for (const s of symbols) {
      const score = fuzzyScore(q, s.name);
      if (score !== null) {
        scored.push({ value: s.name, label: s.name, kind: SYMBOL_KIND_LABEL[s.kind] ?? s.kind, hint: fileById.get(s.fileId)?.path, score });
      }
    }
    const seen = new Set<string>();
    return scored
      .sort((a, b) => b.score - a.score)
      .filter((s) => (seen.has(`${s.kind}:${s.value}:${s.hint}`) ? false : (seen.add(`${s.kind}:${s.value}:${s.hint}`), true)));
  }, [files, symbols, query]);
};

export default useTraceSuggestions;
