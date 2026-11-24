import type { Feature, ProjectSnapshot, TestCase } from "./types";

export interface Progress {
  /** 0..1 */
  ratio: number;
  done: number;
  total: number;
}

const ratio = (done: number, total: number): Progress => ({
  done,
  total,
  ratio: total === 0 ? 0 : done / total,
});

/**
 * Un feature cuenta como completo cuando está en estado "done" y ninguno de sus tests falla.
 * Su progreso parcial: estado (in_progress = 0.5) ajustado por los tests que pasan.
 */
export function featureProgress(feature: Feature, tests: TestCase[]): Progress {
  // Only tests with a known result count: one that was detected but never run says nothing yet.
  const own = tests.filter((t) => t.featureId === feature.id && (t.lastResult === "passing" || t.lastResult === "failing"));
  const passing = own.filter((t) => t.lastResult === "passing").length;
  const failing = own.some((t) => t.lastResult === "failing");
  const statusScore =
    feature.status === "done" ? 1 : feature.status === "in_progress" || feature.status === "needs_review" ? 0.5 : 0;
  if (own.length === 0) return { done: statusScore, total: 1, ratio: statusScore };
  const testScore = passing / own.length;
  const score = failing && statusScore === 1 ? 0.9 : (statusScore + testScore) / 2;
  return { done: score, total: 1, ratio: score };
}

/** % de un requerimiento = criterios del DoD cumplidos / total. Sin DoD, cae al promedio de sus features. */
export function requirementProgress(snapshot: ProjectSnapshot, requirementId: string): Progress {
  const items = snapshot.dod.filter((d) => d.requirementId === requirementId);
  if (items.length > 0) return ratio(items.filter((d) => d.status === "done").length, items.length);
  const features = snapshot.features.filter((f) => f.requirementId === requirementId && f.status !== "orphaned");
  if (features.length === 0) return ratio(0, 0);
  const sum = features.reduce((acc, f) => acc + featureProgress(f, snapshot.tests).ratio, 0);
  return { done: sum, total: features.length, ratio: sum / features.length };
}

/** % del proyecto = promedio ponderado (por `weight`) de los requerimientos. */
export function projectProgress(snapshot: ProjectSnapshot): Progress {
  let weighted = 0;
  let totalWeight = 0;
  for (const r of snapshot.requirements) {
    const w = r.weight > 0 ? r.weight : 1;
    weighted += requirementProgress(snapshot, r.id).ratio * w;
    totalWeight += w;
  }
  return { done: weighted, total: totalWeight, ratio: totalWeight === 0 ? 0 : weighted / totalWeight };
}

export const toPercent = (p: Progress) => Math.round(p.ratio * 100);
