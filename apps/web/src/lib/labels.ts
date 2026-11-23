import type { DodStatus, Platform } from "./api";

export const PLATFORM_LABEL: Record<Platform, string> = { web: "Web", desktop: "Escritorio", mobile: "Móvil" };

export const FEATURE_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  done: "Hecho",
  needs_review: "Requiere revisión",
  orphaned: "Huérfano",
};

export const nextDodStatus = (status: DodStatus): DodStatus => (status === "done" ? "pending" : "done");

export const platformList = (platforms: Platform[]) => platforms.map((x) => PLATFORM_LABEL[x]).join(", ");
