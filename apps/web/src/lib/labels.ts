import type { DodStatus, GithubFileKind, Platform, TestIdeaStatus } from "./api";

export const PLATFORM_LABEL: Record<Platform, string> = { web: "Web", desktop: "Escritorio", mobile: "Móvil" };

export const FEATURE_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  done: "Hecho",
  needs_review: "Requiere revisión",
  orphaned: "Huérfano",
};

export const nextDodStatus = (status: DodStatus): DodStatus => (status === "done" ? "pending" : "done");

export const GITHUB_FILE_LABELS: Record<GithubFileKind, string> = {
  ci: "Pipeline de CI",
  prTemplate: "Plantilla de pull request",
};

export const platformList = (platforms: Platform[]) => platforms.map((x) => PLATFORM_LABEL[x]).join(", ");

export const SYMBOL_KIND_LABEL: Record<string, string> = {
  function: "función",
  class: "clase",
  variable: "variable",
  type: "tipo",
  constant: "constante",
};

export const TEST_TYPE_LABEL: Record<string, string> = {
  unit: "Unitarios",
  integration: "Integración",
  e2e: "End to end",
  component: "Componente",
  contract: "Contrato",
  performance: "Rendimiento",
  other: "Otros",
};

export const TEST_RESULT_LABEL: Record<string, string> = {
  unknown: "Sin ejecutar",
  passing: "Pasa",
  failing: "Falla",
  skipped: "Omitido",
};

export const TEST_RESULT_TONE = { unknown: "neutral", passing: "ok", failing: "danger", skipped: "warn" } as const;

export const TEST_IDEA_STATUS_LABEL: Record<TestIdeaStatus, string> = {
  proposed: "Propuesta",
  accepted: "Aceptada",
  implemented: "Implementada",
  discarded: "Descartada",
};

export const TEST_IDEA_STATUS_TONE = { proposed: "neutral", accepted: "brand", implemented: "ok", discarded: "warn" } as const;

export const FEATURE_STATUS_TONE = {
  pending: "neutral",
  in_progress: "brand",
  done: "ok",
  needs_review: "warn",
  orphaned: "danger",
} as const;

/** "agent:claude-code" shows as "claude-code"; the local user as "Tú". */
/** Actor of what repository analysis found (same value as INFERRED_ACTOR in packages/tracking). */
export const INFERRED_ACTOR = "repo:analysis";

export const actorLabel = (actor: string) =>
  actor === "user:local" ? "Tú" : actor === INFERRED_ACTOR ? "Análisis del repo" : actor.replace(/^(agent|user):/, "");
