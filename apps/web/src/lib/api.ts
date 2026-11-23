import type {
  BusinessRule,
  DatabaseOption,
  DodItem,
  DodStatus,
  Platform,
  Project,
  ProjectFile,
  ProjectSkill,
  ProjectSnapshot,
  SkillSource,
  StackOption,
  StackRecommendation,
} from "@agent-tracking/core";

export type {
  BusinessRule,
  DatabaseOption,
  DodItem,
  DodStatus,
  Platform,
  Project,
  ProjectFile,
  ProjectSkill,
  SkillSource,
  StackOption,
  StackRecommendation,
};

export type ProjectView = ProjectSnapshot & {
  progress: { project: number; requirements: Record<string, number>; features: Record<string, number> };
};
export type ProjectListItem = Project & { progress: number };
export type DiscoveredSkill = { name: string; description: string; source: SkillSource; location: string; plugin?: string };
export type RepoInfo = { root: string; name: string; branch: string | null; remoteUrl: string | null };
export type RepoInspection = {
  repo: RepoInfo;
  projectFile: ProjectFile | null;
  projectFileError: string | null;
  existingProjectId: string | null;
};
export type SkillInput = Omit<ProjectSkill, "id" | "projectId">;
export type NewProject = {
  name: string;
  goal: string;
  platforms: Platform[];
  stack: string[];
  databases: string[];
  repoPath: string | null;
  repoUrl: string | null;
  rules: string[];
  skills: SkillInput[];
  requirements: { title: string; description: string; dod: { criterion: string; origin: "human" | "llm" }[] }[];
};

/** Project data the assistant reads; wizard drafts send what has been filled so far. */
export type AssistantBrief = {
  name?: string;
  goal?: string;
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

const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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
  syncProject: (id: string) => request<ProjectView>("POST", `${p(id)}/sync`),

  stackOptions: () => request<{ stack: StackOption[]; databases: DatabaseOption[] }>("GET", "/stack/options"),
  recommendStack: (platforms: Platform[]) =>
    request<StackRecommendation>("GET", `/stack/recommend?platforms=${platforms.join(",")}`),
  discoverSkills: (repoPath?: string | null) =>
    request<DiscoveredSkill[]>("GET", `/skills/discover${repoPath ? `?repoPath=${encodeURIComponent(repoPath)}` : ""}`),
  catalogSkills: () => request<DiscoveredSkill[]>("GET", "/skills/catalog"),
  createSkill: (data: { name: string; description: string; body?: string; target: "user" | "repo"; repoPath?: string }) =>
    request<DiscoveredSkill>("POST", "/skills", data),

  inspectRepo: (path: string) => request<RepoInspection>("POST", "/import/inspect", { path }),
  cloneRoot: () => request<{ cloneRoot: string }>("GET", "/import/clone-root"),
  cloneRepo: (url: string, dest: string) => request<RepoInspection>("POST", "/import/clone", { url, dest }),
  importRepo: (path: string) => request<ProjectView>("POST", "/import", { path }),

  addRule: (id: string, text: string, priority: number) => request<BusinessRule>("POST", `${p(id)}/rules`, { text, priority }),
  deleteRule: (id: string, ruleId: string) => request<void>("DELETE", `${p(id)}/rules/${ruleId}`),

  toggleSkill: (id: string, skillId: string, enabled: boolean) =>
    request<ProjectSkill>("PATCH", `${p(id)}/skills/${skillId}`, { enabled }),
  removeSkill: (id: string, skillId: string) => request<void>("DELETE", `${p(id)}/skills/${skillId}`),

  addRequirement: (id: string, title: string, description: string) =>
    request<{ id: string }>("POST", `${p(id)}/requirements`, { title, description }),
  deleteRequirement: (id: string, reqId: string) => request<void>("DELETE", `${p(id)}/requirements/${reqId}`),
  addDod: (id: string, reqId: string, criterion: string, origin: "human" | "llm" = "human") =>
    request<DodItem>("POST", `${p(id)}/requirements/${reqId}/dod`, { criterion, origin }),
  setDodStatus: (id: string, reqId: string, dodId: string, status: DodStatus) =>
    request<DodItem>("PATCH", `${p(id)}/requirements/${reqId}/dod/${dodId}`, { status }),
  deleteDod: (id: string, reqId: string, dodId: string) =>
    request<void>("DELETE", `${p(id)}/requirements/${reqId}/dod/${dodId}`),

  assistantStatus: () => request<{ configured: boolean }>("GET", "/assistant"),
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
