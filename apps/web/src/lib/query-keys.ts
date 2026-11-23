import type { Platform } from "./api";

export const queryKeys = {
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  context: (id: string) => ["projects", id, "context"] as const,
  activity: (id: string) => ["projects", id, "activity"] as const,
  stackOptions: ["stack", "options"] as const,
  recommendation: (platforms: Platform[]) => ["stack", "recommend", [...platforms].sort().join(",")] as const,
  installedSkills: (repoPath: string | null) => ["skills", "installed", repoPath ?? ""] as const,
  catalogSkills: ["skills", "catalog"] as const,
  cloneRoot: ["import", "clone-root"] as const,
};
