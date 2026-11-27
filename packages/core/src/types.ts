export const PLATFORMS = ["web", "desktop", "mobile"] as const;
export type Platform = (typeof PLATFORMS)[number];

export type Actor = { kind: "user" | "agent"; id: string };

export type DodStatus = "pending" | "done" | "failed";
export type FeatureStatus = "pending" | "in_progress" | "done" | "needs_review" | "orphaned";
export type TestType = "unit" | "integration" | "e2e" | "component" | "contract" | "performance" | "other";
export type TestResult = "unknown" | "passing" | "failing" | "skipped";
export type SkillSource = "user" | "repo" | "plugin" | "catalog" | "created";
export const SYMBOL_KINDS = ["function", "class", "variable", "type", "constant"] as const;
export type SymbolKind = (typeof SYMBOL_KINDS)[number];
export type SymbolSource = "reported" | "inferred";
export const TEST_IDEA_STATUSES = ["proposed", "accepted", "implemented", "discarded"] as const;
export type TestIdeaStatus = (typeof TEST_IDEA_STATUSES)[number];

export interface Project {
  id: string;
  name: string;
  goal: string;
  /** Agents that work on the project (claude-code, codex, gemini-cli): their instruction files get the Agent Tracking block. */
  agents?: string[];
  /** How commits and branches are written; null means the defaults (Conventional Commits). */
  commitConventions?: import("./conventions").CommitConventions | null;
  /** What is being built; see PROJECT_KIND_INFO. Older projects are "fullstack". */
  kind: import("./project-kind").ProjectKind;
  platforms: Platform[];
  stack: string[];
  databases: string[];
  repoPath: string | null;
  repoUrl: string | null;
  /** One app, or a monorepo of pieces; older projects are "single". See parts.ts. */
  structure?: import("./parts").ProjectStructure;
  parts?: import("./parts").ProjectPart[];
  monorepoTool?: string | null;
  /** Kinds of tests agents are expected to write; empty means none were set. */
  testTypes?: TestType[];
  /** Language agents use with the person (answers, summaries, reports); null when not set. */
  replyLanguage?: import("./reply-language").ReplyLanguage | null;
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
  /** Plugin that ships the skill and its marketplace, so others can install the same plugin. */
  plugin: string | null;
  marketplace: string | null;
  /** Where the marketplace comes from (GitHub "owner/repo", URL or path), for `claude plugin marketplace add`. */
  marketplaceSource: string | null;
  /** Copied into the repository (.agent-tracking/skills) so collaborators can install it. */
  shared: boolean;
}

export interface DodItem {
  id: string;
  requirementId: string;
  criterion: string;
  origin: "human" | "llm";
  status: DodStatus;
  evidence: string | null;
  /** Set by the database; orders the entries and travels in the project file. */
  createdAt?: string;
}

/** Functional: what the system does. Non functional: how well it does it (speed, security...). */
export const REQUIREMENT_TYPES = ["functional", "non_functional"] as const;
export type RequirementType = (typeof REQUIREMENT_TYPES)[number];
/** Where a functional requirement lives in the system. */
export const FUNCTIONAL_AREAS = ["general", "frontend", "backend", "data", "integration", "infra"] as const;
/** Which quality a non functional requirement is about. "ux" is usability (kept for stored data). */
export const QUALITY_AREAS = ["performance", "security", "ux", "accessibility", "reliability", "scalability", "maintainability", "compatibility"] as const;
/** Area of a requirement: a part of the system when functional, a quality attribute when not. */
export const REQUIREMENT_AREAS = [...FUNCTIONAL_AREAS, ...QUALITY_AREAS] as const;
export type RequirementArea = (typeof REQUIREMENT_AREAS)[number];

export interface Requirement {
  id: string;
  projectId: string;
  /** Short code within the project (RF1, RNF2…), editable; see requirement-code.ts. */
  code?: string | null;
  title: string;
  description: string;
  type: RequirementType;
  area: RequirementArea;
  /** Peso relativo para el % global del proyecto (por defecto 1). */
  weight: number;
  /** Ids of the project's pieces it touches (monorepos); empty when it is about the whole project. */
  parts?: string[];
  /** Set by the database; orders the entries and travels in the project file. */
  createdAt?: string;
}

export interface Feature {
  id: string;
  requirementId: string;
  name: string;
  description: string;
  status: FeatureStatus;
  agent: string | null;
  /** Set by the database; orders the entries and travels in the project file. */
  createdAt?: string;
}

export interface TestCase {
  id: string;
  featureId: string | null;
  requirementId: string | null;
  path: string;
  name: string;
  type: TestType;
  lastResult: TestResult;
  /** Who added it; the analysis of the code adds tests on its own (INFERRED_ACTOR). */
  createdBy?: string;
}

/** A repository file that an agent created or touched. `path` is relative to the repo root. */
export interface FileArtifact {
  id: string;
  projectId: string;
  path: string;
  purpose: string;
  /** Last change seen by repository analysis. */
  changedAt: string | null;
  /** Last agent report that covered the file; pending while changedAt is later. */
  reportedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFile {
  featureId: string;
  fileId: string;
}

export interface CodeSymbol {
  id: string;
  fileId: string;
  name: string;
  kind: SymbolKind;
  lineStart: number | null;
  lineEnd: number | null;
  purpose: string;
  source: SymbolSource;
}

export interface TestIdea {
  id: string;
  projectId: string;
  featureId: string | null;
  requirementId: string | null;
  text: string;
  origin: "human" | "llm";
  status: TestIdeaStatus;
  createdBy: string;
  createdAt: string;
}

/** One entry of the agent activity log. `actor` is "agent:<name>" or "user:<id>". */
export interface AgentEvent {
  id: string;
  projectId: string;
  actor: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
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
  files: FileArtifact[];
  featureFiles: FeatureFile[];
  symbols: CodeSymbol[];
  testIdeas: TestIdea[];
  /** Images: references attached to requirements and criteria, and screens of the app. */
  attachments: Attachment[];
}

export type AttachmentKind = "reference" | "screen";
/** Metadata only; the bytes are served by GET /api/attachments/:id. */
export interface Attachment {
  id: string;
  projectId: string;
  kind: AttachmentKind;
  requirementId: string | null;
  dodItemId: string | null;
  featureId: string | null;
  /** For screens: the view's name ("Lista de gastos") and its route or where it lives. */
  title: string;
  route: string;
  filename: string;
  mime: string;
  size: number;
  createdBy: string;
  createdAt: string;
}
