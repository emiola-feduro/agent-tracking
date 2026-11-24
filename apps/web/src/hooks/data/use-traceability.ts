import { useMemo } from "react";
import type { CodeSymbol, FileArtifact, ProjectView } from "@/lib/api";

/** Indexes files and symbols by feature and file so the trace tree renders without repeated scans. */
const useTraceability = (view: ProjectView) => {
  const { files, featureFiles, symbols } = view;

  return useMemo(() => {
    const fileById = new Map(files.map((f) => [f.id, f]));
    const filesByFeature = new Map<string, FileArtifact[]>();
    const linked = new Set<string>();
    for (const { featureId, fileId } of featureFiles) {
      const file = fileById.get(fileId);
      if (!file) continue;
      linked.add(fileId);
      filesByFeature.set(featureId, [...(filesByFeature.get(featureId) ?? []), file]);
    }
    for (const list of filesByFeature.values()) list.sort((a, b) => a.path.localeCompare(b.path));

    const symbolsByFile = new Map<string, CodeSymbol[]>();
    for (const symbol of symbols) symbolsByFile.set(symbol.fileId, [...(symbolsByFile.get(symbol.fileId) ?? []), symbol]);

    return {
      filesOf: (featureId: string) => filesByFeature.get(featureId) ?? [],
      symbolsOf: (fileId: string) => symbolsByFile.get(fileId) ?? [],
      unlinkedFiles: files.filter((f) => !linked.has(f.id)),
    };
  }, [files, featureFiles, symbols]);
};

export default useTraceability;
