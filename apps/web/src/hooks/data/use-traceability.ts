import { useMemo } from "react";
import type { CodeSymbol, Feature, FileArtifact, ProjectView, Requirement } from "@/lib/api";

/** Changed in the repository after the last agent report that covered it. */
export const isPending = ({ changedAt, reportedAt }: FileArtifact) => !!changedAt && (!reportedAt || changedAt > reportedAt);

/** Where a file belongs in the requirement tree. */
export type FileLink = { feature: Feature; requirement: Requirement | null };

/** Indexes files and symbols by feature and file so the trace views render without repeated scans. */
const useTraceability = (view: ProjectView) => {
  const { files, featureFiles, symbols, features, requirements } = view;

  return useMemo(() => {
    const fileById = new Map(files.map((f) => [f.id, f]));
    const featureById = new Map(features.map((f) => [f.id, f]));
    const requirementById = new Map(requirements.map((r) => [r.id, r]));
    const filesByFeature = new Map<string, FileArtifact[]>();
    const linksByFile = new Map<string, FileLink[]>();
    for (const { featureId, fileId } of featureFiles) {
      const file = fileById.get(fileId);
      const feature = featureById.get(featureId);
      if (!file || !feature) continue;
      filesByFeature.set(featureId, [...(filesByFeature.get(featureId) ?? []), file]);
      linksByFile.set(fileId, [...(linksByFile.get(fileId) ?? []), { feature, requirement: requirementById.get(feature.requirementId) ?? null }]);
    }
    for (const list of filesByFeature.values()) list.sort((a, b) => a.path.localeCompare(b.path));

    const symbolsByFile = new Map<string, CodeSymbol[]>();
    for (const symbol of symbols) symbolsByFile.set(symbol.fileId, [...(symbolsByFile.get(symbol.fileId) ?? []), symbol]);

    return {
      filesOf: (featureId: string) => filesByFeature.get(featureId) ?? [],
      symbolsOf: (fileId: string) => symbolsByFile.get(fileId) ?? [],
      linksOf: (fileId: string) => linksByFile.get(fileId) ?? [],
      /** Live layer: what the agent changed and has not reported yet, newest first. */
      pendingFiles: files.filter(isPending).sort((a, b) => (b.changedAt ?? "").localeCompare(a.changedAt ?? "")),
      /** Reported or mapped code that no feature claims. */
      unlinkedFiles: files.filter((f) => !linksByFile.has(f.id) && !isPending(f)),
      allFiles: [...files].sort((a, b) => a.path.localeCompare(b.path)),
    };
  }, [files, featureFiles, symbols, features, requirements]);
};

export type Traceability = ReturnType<typeof useTraceability>;

/** Whether a file, its purpose or one of its symbols matches a search (case and accent insensitive). */
export const fileMatches = (file: FileArtifact, symbols: CodeSymbol[], query: string) => {
  const q = normalize(query.trim());
  if (!q) return true;
  return [file.path, file.purpose ?? "", ...symbols.flatMap((s) => [s.name, s.purpose ?? ""])].some((t) => normalize(t).includes(q));
};

const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default useTraceability;
