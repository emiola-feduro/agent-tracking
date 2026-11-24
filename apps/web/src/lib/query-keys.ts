import type { Platform, ProjectKind } from "./api";

export const queryKeys = {
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  context: (id: string) => ["projects", id, "context"] as const,
  activity: (id: string) => ["projects", id, "activity"] as const,
  branch: (id: string) => ["projects", id, "branch"] as const,
  // Outside the project prefix: hook events refresh only this, not the whole snapshot.
  live: (id: string) => ["live", id] as const,
  stackOptions: ["stack", "options"] as const,
  recommendation: (kind: ProjectKind, platforms: Platform[]) => ["stack", "recommend", kind, [...platforms].sort().join(",")] as const,
  installedSkills: (repoPath: string | null) => ["skills", "installed", repoPath ?? ""] as const,
  catalogSkills: ["skills", "catalog"] as const,
  cloneRoot: ["import", "clone-root"] as const,
  assistant: ["assistant"] as const,
};
