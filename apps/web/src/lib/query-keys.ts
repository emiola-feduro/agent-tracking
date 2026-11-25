import type { Platform, ProjectKind } from "./api";

export const queryKeys = {
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  context: (id: string) => ["projects", id, "context"] as const,
  activity: (id: string) => ["projects", id, "activity"] as const,
  branch: (id: string) => ["projects", id, "branch"] as const,
  branches: (id: string) => ["projects", id, "branches"] as const,
  worktrees: (id: string) => ["projects", id, "worktrees"] as const,
  worktreeDiff: (id: string, worktree: string) => ["projects", id, "worktree-diff", worktree] as const,
  file: (id: string, path: string, worktree = "") => ["projects", id, "file", worktree, path] as const,
  turns: (id: string) => ["projects", id, "turns"] as const,
  skillStatus: (id: string) => ["projects", id, "skill-status"] as const,
  turn: (id: string, turnId: string) => ["projects", id, "turn", turnId] as const,
  // Outside the project prefix: hook events refresh only this, not the whole snapshot.
  live: (id: string) => ["live", id] as const,
  stackOptions: ["stack", "options"] as const,
  recommendation: (kind: ProjectKind, platforms: Platform[]) => ["stack", "recommend", kind, [...platforms].sort().join(",")] as const,
  installedSkills: (repoPath: string | null) => ["skills", "installed", repoPath ?? ""] as const,
  catalogSkills: ["skills", "catalog"] as const,
  cloneRoot: ["import", "clone-root"] as const,
  assistant: ["assistant"] as const,
  assistantProviders: ["assistant", "providers"] as const,
  githubAccount: ["github", "account"] as const,
};
