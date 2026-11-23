export const PLATFORMS = ["web", "desktop", "mobile"] as const;
export type Platform = (typeof PLATFORMS)[number];

export type Actor = { kind: "user" | "agent"; id: string };

export type DodStatus = "pending" | "done" | "failed";
export type FeatureStatus = "pending" | "in_progress" | "done" | "needs_review" | "orphaned";
export type TestType = "unit" | "integration" | "e2e" | "component" | "contract" | "performance" | "other";
export type TestResult = "unknown" | "passing" | "failing" | "skipped";
export type SkillSource = "user" | "repo" | "plugin" | "catalog" | "created";

export interface Project {
  id: string;
  name: string;
  goal: string;
  platforms: Platform[];
  stack: string[];
  databases: string[];
  repoPath: string | null;
  repoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessRule {
  id: string;
  projectId: string;
  text: string;
  priority: number;
}

export interface ProjectSkill {
  id: string;
  projectId: string;
  name: string;
  description: string;
  source: SkillSource;
  location: string;
  enabled: boolean;
}

export interface DodItem {
  id: string;
  requirementId: string;
  criterion: string;
  origin: "human" | "llm";
  status: DodStatus;
  evidence: string | null;
}

export interface Requirement {
  id: string;
  projectId: string;
  title: string;
  description: string;
  /** Peso relativo para el % global del proyecto (por defecto 1). */
  weight: number;
}

export interface Feature {
  id: string;
  requirementId: string;
  name: string;
  description: string;
  status: FeatureStatus;
  agent: string | null;
}

export interface TestCase {
  id: string;
  featureId: string | null;
  requirementId: string | null;
  path: string;
  name: string;
  type: TestType;
  lastResult: TestResult;
}

/** Vista agregada del proyecto que usan el cálculo de % y el generador de contexto. */
export interface ProjectSnapshot {
  project: Project;
  rules: BusinessRule[];
  skills: ProjectSkill[];
  requirements: Requirement[];
  dod: DodItem[];
  features: Feature[];
  tests: TestCase[];
}
