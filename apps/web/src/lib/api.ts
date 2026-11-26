import type {
  AgentEvent,
  CommitConventions,
  Attachment,
  BusinessRule,
  CodeSymbol,
  DatabaseOption,
  DodItem,
  DodStatus,
  Feature,
  FileArtifact,
  Platform,
  Project,
  ProjectFile,
  ProjectKind,
  ProjectSkill,
  ProjectSnapshot,
  Requirement,
  RequirementArea,
  RequirementType,
  SkillSource,
  StackOption,
  StackRecommendation,
  TestCase,
  TestIdea,
  TestIdeaStatus,
} from "@agent-tracking/core";

export type {
  AgentEvent,
  Attachment,
  BusinessRule,
  CodeSymbol,
  DatabaseOption,
  DodItem,
  DodStatus,
  Feature,
  FileArtifact,
  Platform,
  Project,
  ProjectFile,
  ProjectKind,
  ProjectSkill,
  Requirement,
  RequirementArea,
  RequirementType,
  SkillSource,
  StackOption,
  StackRecommendation,
  TestCase,
  TestIdea,
  TestIdeaStatus,
};

export type ProjectView = ProjectSnapshot & {
  progress: { project: number; requirements: Record<string, number>; features: Record<string, number> };
};
/** What the agent is doing right now (Claude Code hooks, kept in memory by the server). */
export type LiveStep = { at: string; tool: string; label: string; target?: string };
/** One agent session (Claude Code, Codex CLI, Gemini CLI...) seen through its hooks. */
export type LiveSession = { agent: string; sessionId: string; status: "working" | "idle"; startedAt: string; lastAt: string; steps: LiveStep[] };
export type LiveState = {
  status: "working" | "idle";
  startedAt: string | null;
  lastAt: string | null;
  steps: LiveStep[];
  /** Agent of the most recent session. */
  agent: string | null;
  sessions: LiveSession[];
};
export type GithubFileKind = "ci" | "prTemplate";
export type AgentKind = "claude-code" | "codex" | "gemini-cli";
export type AgentInfo = {
  kind: AgentKind;
  label: string;
  installed: boolean;
  mcp: boolean;
  hooks: boolean;
  /** Hooks written by an older Agent Tracking: connecting again updates them. */
  hooksOutdated: boolean;
  configPath: string;
  contextFile: string;
  lastSeen: string | null;
};
export type ConfigChange =
  | { type: "file"; path: string; description: string; before: string | null; after: string }
  | { type: "command"; argv: string[]; description: string };
export type GithubPublish = { owner: string; name: string; visibility: "private" | "public"; description?: string };
/** Whether a project skill is on this machine and how to get it if not. */
export type SkillAvailability = { skillId: string; installed: boolean; install: "shared" | "plugin" | null; commands: string[] | null };
export type FileContent = { path: string; content: string; lines: number; truncated: boolean; binary: boolean };
export type DiffFile = { path: string; insertions: number; deletions: number; binary: boolean };
export type Diff = { files: DiffFile[]; patch: string; truncated: boolean };
export type BranchProgress = {
  ahead: number;
  behind: number;
  dirty: number;
  files: number;
  insertions: number;
  deletions: number;
  lastCommit: { sha: string; subject: string; date: string } | null;
};
export type Worktree = { path: string; branch: string | null; head: string; main: boolean; locked: boolean; prunable: boolean; progress: BranchProgress | null };
export type LocalBranch = {
  name: string;
  sha: string;
  current: boolean;
  upstream: string | null;
  lastCommitDate: string;
  subject: string;
  /** Commits only this branch has, compared with the base: what deleting it would lose. */
  unmerged: number;
  /** An agent is working on it right now. */
  agent: boolean;
};
/** One request to an agent: what was asked, its steps, its final answer and the files it changed. */
export type AgentTurn = {
  id: string;
  sessionId: string | null;
  /** claude-code, codex, gemini-cli, or the MCP client name of another agent. */
  agent: string;
  cwd: string;
  branch: string | null;
  prompt: string;
  summary: string;
  steps: LiveStep[];
  files: DiffFile[];
  startedAt: string;
  endedAt: string | null;
};
export type AgentTurnDetail = AgentTurn & { patch: string; patchTruncated: boolean };
export type ProjectListItem = Project & { progress: number };
export type DiscoveredSkill = { name: string; description: string; source: SkillSource; location: string; plugin?: string };
export type RepoInfo = { root: string; name: string; branch: string | null; remoteUrl: string | null };
export type RepoInspection = {
  repo: RepoInfo;
  projectFile: ProjectFile | null;
  projectFileError: string | null;
  existingProjectId: string | null;
};
export type SkillInput = Pick<ProjectSkill, "name" | "description" | "source" | "location" | "enabled">;
export type NewProject = {
  name: string;
  goal: string;
  commitConventions: CommitConventions | null;
  agents: AgentKind[];
  kind: ProjectKind;
  platforms: Platform[];
  stack: string[];
  databases: string[];
  repoPath: string | null;
  repoUrl: string | null;
  githubFiles: GithubFileKind[];
  /** The pull request template as edited in the wizard; the server generates one when missing. */
  prTemplate?: string;
  rules: string[];
  skills: SkillInput[];
  requirements: { title: string; description: string; type?: RequirementType; area?: RequirementArea; dod: { criterion: string; origin: "human" | "llm" }[] }[];
};

export type AssistantProviderId = "api" | "claude-code" | "openai-api" | "gemini-api" | "codex-cli" | "gemini-cli";
/** A provider the server can use; `vendor` is whose tokens a request spends. Empty models mean the CLI's default. */
export type AssistantProviderInfo = { id: AssistantProviderId; label: string; vendor: string; models: { default: string; heavy: string } };
export type AssistantProviders = { active: AssistantProviderId | null; providers: AssistantProviderInfo[] };

/** Project data the assistant reads; wizard drafts send what has been filled so far. */
export type AssistantBrief = {
  name?: string;
  goal?: string;
  kind: ProjectKind;
  platforms: Platform[];
  stack?: string[];
  databases?: string[];
  rules?: string[];
  requirements?: { title: string; description?: string }[];
};
export type StackSuggestion = { source: "assistant" | "default"; recommendation: StackRecommendation };
export type SkillPick = { id: string; reason: string };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Reads that take longer than this are given up and retried, instead of leaving a skeleton forever. */
const READ_TIMEOUT_MS = 12_000;

export const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      // Writes may legitimately take long (cloning, the assistant); reads should not.
      signal: method === "GET" ? AbortSignal.timeout(READ_TIMEOUT_MS) : undefined,
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new ApiError(timedOut ? "El servidor no respondió a tiempo" : "No hay conexión con el servidor", 0, {});
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(data.error ?? res.statusText, res.status, data);
  }
  if (res.status === 204) return undefined as T;
  return res.headers.get("content-type")?.includes("json") ? res.json() : (res.text() as Promise<T>);
};

const p = (id: string) => `/projects/${encodeURIComponent(id)}`;

export const api = {
  listProjects: () => request<ProjectListItem[]>("GET", "/projects"),
  getProject: (id: string) => request<ProjectView>("GET", p(id)),
  createProject: (data: NewProject) => request<ProjectView>("POST", "/projects", data),
  deleteProject: (id: string) => request<void>("DELETE", p(id)),
  updateProject: (id: string, data: { commitConventions?: CommitConventions | null; agents?: AgentKind[] }) => request<ProjectView>("PATCH", p(id), data),
  agents: () => request<AgentInfo[]>("GET", "/agents"),
  agentPlan: (kind: AgentKind, action: "connect" | "disconnect") => request<ConfigChange[]>("GET", `/agents/${kind}/${action}-plan`),
  applyAgentPlan: (kind: AgentKind, action: "connect" | "disconnect", plan: ConfigChange[]) =>
    request<{ done: string[] }>("POST", `/agents/${kind}/${action}`, { plan }),
  syncProject: (id: string) => request<ProjectView>("POST", `${p(id)}/sync`),

  stackOptions: () => request<{ stack: StackOption[]; databases: DatabaseOption[] }>("GET", "/stack/options"),
  recommendStack: (kind: ProjectKind, platforms: Platform[]) =>
    request<StackRecommendation>("GET", `/stack/recommend?kind=${kind}&platforms=${platforms.join(",")}`),
  discoverSkills: (repoPath?: string | null) =>
    request<DiscoveredSkill[]>("GET", `/skills/discover${repoPath ? `?repoPath=${encodeURIComponent(repoPath)}` : ""}`),
  catalogSkills: () => request<DiscoveredSkill[]>("GET", "/skills/catalog"),
  createSkill: (data: { name: string; description: string; body?: string; target: "user" | "repo"; repoPath?: string }) =>
    request<DiscoveredSkill>("POST", "/skills", data),

  inspectRepo: (path: string) => request<RepoInspection>("POST", "/import/inspect", { path }),
  cloneRoot: () => request<{ cloneRoot: string }>("GET", "/import/clone-root"),
  initRepo: (path: string) => request<RepoInspection>("POST", "/import/init", { path }),
  cloneRepo: (url: string, dest: string) => request<RepoInspection>("POST", "/import/clone", { url, dest }),
  importRepo: (path: string) => request<ProjectView>("POST", "/import", { path }),

  addRule: (id: string, text: string, priority: number) => request<BusinessRule>("POST", `${p(id)}/rules`, { text, priority }),
  deleteRule: (id: string, ruleId: string) => request<void>("DELETE", `${p(id)}/rules/${ruleId}`),

  toggleSkill: (id: string, skillId: string, enabled: boolean) =>
    request<ProjectSkill>("PATCH", `${p(id)}/skills/${skillId}`, { enabled }),
  removeSkill: (id: string, skillId: string) => request<void>("DELETE", `${p(id)}/skills/${skillId}`),
  shareSkill: (id: string, skillId: string, shared: boolean) => request<ProjectSkill>("PATCH", `${p(id)}/skills/${skillId}`, { shared }),
  skillStatus: (id: string) => request<SkillAvailability[]>("GET", `${p(id)}/skills/status`),
  installSkill: (id: string, skillId: string) => request<SkillAvailability>("POST", `${p(id)}/skills/${skillId}/install`),

  addRequirement: (id: string, data: { title: string; description: string; type?: RequirementType; area?: RequirementArea }) =>
    request<{ id: string }>("POST", `${p(id)}/requirements`, data),
  importRequirements: (id: string, text: string) =>
    request<{ created: number; ids: string[]; warnings: string[] }>("POST", `${p(id)}/requirements/import`, { text }),
  updateRequirement: (id: string, reqId: string, data: Partial<{ title: string; description: string; type: RequirementType; area: RequirementArea }>) =>
    request<{ id: string }>("PATCH", `${p(id)}/requirements/${reqId}`, data),
  deleteRequirement: (id: string, reqId: string) => request<void>("DELETE", `${p(id)}/requirements/${reqId}`),
  addDod: (id: string, reqId: string, criterion: string, origin: "human" | "llm" = "human") =>
    request<DodItem>("POST", `${p(id)}/requirements/${reqId}/dod`, { criterion, origin }),
  setDodStatus: (id: string, reqId: string, dodId: string, status: DodStatus) =>
    request<DodItem>("PATCH", `${p(id)}/requirements/${reqId}/dod/${dodId}`, { status }),
  deleteDod: (id: string, reqId: string, dodId: string) =>
    request<void>("DELETE", `${p(id)}/requirements/${reqId}/dod/${dodId}`),

  githubAccount: () => request<{ ok: true; account: { login: string; orgs: string[] } } | { ok: false; reason: string }>("GET", "/github/account"),
  publishGithub: (id: string, data: GithubPublish) =>
    request<{ url: string; repoUrl: string; committed: boolean; pushed: boolean }>("POST", `${p(id)}/github/publish`, data),
  repoBranch: (id: string) => request<{ current: string | null }>("GET", `${p(id)}/repo/branches`),
  localBranches: (id: string) => request<{ current: string | null; branches: LocalBranch[]; dirty: string[] }>("GET", `${p(id)}/repo/branches`),
  deleteBranch: (id: string, branch: string, force = false) =>
    request<{ branch: string; sha: string }>("DELETE", `${p(id)}/repo/branches/${encodeURIComponent(branch)}${force ? "?force=1" : ""}`),
  checkout: (id: string, branch: string) => request<{ branch: string; previous: string | null }>("POST", `${p(id)}/repo/checkout`, { branch }),
  worktrees: (id: string) => request<{ base: string | null; worktrees: Worktree[] }>("GET", `${p(id)}/repo/worktrees`),
  worktreeDiff: (id: string, worktree: string) => request<Diff>("GET", `${p(id)}/repo/worktree-diff?worktree=${encodeURIComponent(worktree)}`),
  repoFile: (id: string, path: string, worktree?: string) =>
    request<FileContent>("GET", `${p(id)}/repo/file?path=${encodeURIComponent(path)}${worktree ? `&worktree=${encodeURIComponent(worktree)}` : ""}`),
  turns: (id: string, limit = 20) => request<AgentTurn[]>("GET", `${p(id)}/turns?limit=${limit}`),
  turn: (id: string, turnId: string) => request<AgentTurnDetail>("GET", `${p(id)}/turns/${turnId}`),
  uploadAttachment: async (
    id: string,
    file: File,
    meta: { kind?: "reference" | "screen"; requirementId?: string; dodItemId?: string; featureId?: string; title?: string; route?: string },
  ) => {
    const form = new FormData();
    form.set("file", file);
    for (const [k, v] of Object.entries(meta)) if (v) form.set(k, v);
    const res = await fetch(`/api${p(id)}/attachments`, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error ?? res.statusText, res.status, data);
    return data as Attachment;
  },
  updateAttachment: (id: string, attachmentId: string, data: Partial<{ title: string; route: string; featureId: string | null }>) =>
    request<{ id: string }>("PATCH", `${p(id)}/attachments/${attachmentId}`, data),
  deleteAttachment: (id: string, attachmentId: string) => request<void>("DELETE", `${p(id)}/attachments/${attachmentId}`),
  live: (id: string) => request<LiveState>("GET", `${p(id)}/live`),
  activity: (id: string, limit = 100) => request<AgentEvent[]>("GET", `${p(id)}/activity?limit=${limit}`),
  addTestIdea: (id: string, data: { text: string; requirementId?: string | null; featureId?: string | null }) =>
    request<TestIdea>("POST", `${p(id)}/test-ideas`, data),
  setTestIdeaStatus: (id: string, ideaId: string, status: TestIdeaStatus) =>
    request<TestIdea>("PATCH", `${p(id)}/test-ideas/${ideaId}`, { status }),
  deleteTestIdea: (id: string, ideaId: string) => request<void>("DELETE", `${p(id)}/test-ideas/${ideaId}`),
  assistantStatus: () =>
    request<{ configured: boolean; provider?: AssistantProviderId; label?: string; vendor?: string }>("GET", "/assistant"),
  assistantProviders: () => request<AssistantProviders>("GET", "/assistant/providers"),
  setAssistantProvider: (provider: AssistantProviderId) => request<AssistantProviders>("PUT", "/assistant/provider", { provider }),
  suggestStack: (brief: AssistantBrief) => request<StackSuggestion>("POST", "/assistant/stack", brief),
  suggestDod: (project: AssistantBrief, requirement: { title: string; description?: string }, existing: string[]) =>
    request<{ criteria: string[] }>("POST", "/assistant/dod", { project, requirement, existing }),
  suggestSkills: (project: AssistantBrief, skills: { id: string; name: string; description: string }[]) =>
    request<{ skills: SkillPick[] }>("POST", "/assistant/skills", { project, skills }),
  suggestProjectDod: (id: string, reqId: string) =>
    request<{ criteria: string[] }>("POST", `${p(id)}/requirements/${reqId}/dod/suggest`),

  contextMarkdown: (id: string) => request<string>("GET", `${p(id)}/context.md`),
  writeRepoFiles: (id: string) => request<{ path: string }>("POST", `${p(id)}/context/write`),
};
