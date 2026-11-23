import type {
  BranchSummary,
  PullDetail,
  PullFilter,
  PullState,
  PullSummary,
  RateLimit,
  RunDetail,
  RunStatus,
  Workflow,
  WorkflowRun,
} from "@agent-tracking/github/src/types";
import { request, type ProjectView } from "./api";
import { queryKeys } from "./query-keys";

export type { BranchSummary, PullDetail, PullFilter, PullState, PullSummary, RateLimit, RunDetail, RunStatus, Workflow, WorkflowRun };

export type GithubAuthInfo = { kind: "token"; source: "env" | "gh-cli" | "app" | "oauth" } | { kind: "anonymous" };
export type GithubStatus = { auth: GithubAuthInfo; rateLimit: RateLimit | null };
export type RunFilter = { branch?: string; workflowId?: number };

const g = (id: string) => `/projects/${encodeURIComponent(id)}/github`;

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : "";
};

export const githubApi = {
  status: () => request<GithubStatus>("GET", "/github/status"),
  refreshAuth: () => request<GithubStatus>("POST", "/github/auth/refresh"),
  watch: (id: string) => request<void>("POST", `${g(id)}/watch`),
  pulls: (id: string, state: PullFilter) => request<PullSummary[]>("GET", `${g(id)}/pulls${query({ state })}`),
  pull: (id: string, number: number) => request<PullDetail>("GET", `${g(id)}/pulls/${number}`),
  branches: (id: string) => request<BranchSummary[]>("GET", `${g(id)}/branches`),
  workflows: (id: string) => request<Workflow[]>("GET", `${g(id)}/workflows`),
  runs: (id: string, filter: RunFilter) => request<WorkflowRun[]>("GET", `${g(id)}/runs${query(filter)}`),
  run: (id: string, runId: number) => request<RunDetail>("GET", `${g(id)}/runs/${runId}`),
  linkRepo: (id: string, repoUrl: string) =>
    request<ProjectView>("PATCH", `/projects/${encodeURIComponent(id)}`, { repoUrl }),
};

/** Nested under the project key, so live events for the project also refresh its GitHub data. */
export const githubKeys = {
  status: ["github", "status"] as const,
  all: (id: string) => [...queryKeys.project(id), "github"] as const,
  pulls: (id: string, state: PullFilter) => [...githubKeys.all(id), "pulls", state] as const,
  pull: (id: string, number: number) => [...githubKeys.all(id), "pull", number] as const,
  branches: (id: string) => [...githubKeys.all(id), "branches"] as const,
  workflows: (id: string) => [...githubKeys.all(id), "workflows"] as const,
  runs: (id: string, filter: RunFilter) => [...githubKeys.all(id), "runs", filter.branch ?? "", filter.workflowId ?? 0] as const,
  run: (id: string, runId: number) => [...githubKeys.all(id), "run", runId] as const,
};
