import type { PullFilter, PullState, RunStatus } from "./github-api";

type Tone = "neutral" | "brand" | "ok" | "warn" | "danger";

export const PULL_STATE: Record<PullState, { label: string; tone: Tone }> = {
  open: { label: "Abierto", tone: "ok" },
  draft: { label: "Borrador", tone: "neutral" },
  merged: { label: "Merged", tone: "brand" },
  closed: { label: "Cerrado", tone: "danger" },
};

export const RUN_STATUS: Record<RunStatus, { label: string; tone: Tone }> = {
  running: { label: "En curso", tone: "warn" },
  success: { label: "Exitoso", tone: "ok" },
  failure: { label: "Fallido", tone: "danger" },
  cancelled: { label: "Cancelado", tone: "neutral" },
  skipped: { label: "Omitido", tone: "neutral" },
  neutral: { label: "Neutral", tone: "neutral" },
};

export const PULL_FILTERS: { value: PullFilter; label: string }[] = [
  { value: "open", label: "Abiertos" },
  { value: "merged", label: "Merged" },
  { value: "closed", label: "Cerrados" },
  { value: "all", label: "Todos" },
];

export const REVIEW_STATE: Record<string, string> = {
  approved: "Aprobado",
  changes_requested: "Pide cambios",
  commented: "Comentó",
  dismissed: "Descartado",
  pending: "Pendiente",
};

export const AUTH_SOURCE: Record<string, string> = {
  env: "GITHUB_TOKEN",
  "gh-cli": "gh CLI",
  app: "GitHub App",
  oauth: "OAuth",
};
