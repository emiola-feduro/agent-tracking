import type { Actor, PullState, PullSummary, RunStatus } from "./types";

type UserLike = { login: string; avatar_url?: string | null } | null | undefined;

export const actor = (u: UserLike): Actor => (u ? { login: u.login, avatarUrl: u.avatar_url ?? null } : null);

export const pullState = (p: { state: string; draft?: boolean | null; merged_at?: string | null }): PullState => {
  if (p.merged_at) return "merged";
  if (p.state === "closed") return "closed";
  return p.draft ? "draft" : "open";
};

export const runStatus = (status: string | null | undefined, conclusion: string | null | undefined): RunStatus => {
  if (status !== "completed") return "running";
  switch (conclusion) {
    case "success":
      return "success";
    case "failure":
    case "timed_out":
    case "startup_failure":
    case "action_required":
      return "failure";
    case "cancelled":
      return "cancelled";
    case "skipped":
      return "skipped";
    default:
      return "neutral";
  }
};

/** Legacy commit statuses (`pending`, `success`, `failure`, `error`). */
export const commitStatus = (state: string): RunStatus =>
  state === "success" ? "success" : state === "pending" ? "running" : "failure";

/** One status for a set of checks: any failure wins, then anything still running. */
export const aggregateStatus = (all: RunStatus[]): RunStatus | null => {
  if (all.length === 0) return null;
  for (const s of ["failure", "running", "success", "cancelled"] as const) if (all.includes(s)) return s;
  return all.includes("skipped") ? "skipped" : "neutral";
};

type PullLike = {
  number: number;
  title: string;
  state: string;
  draft?: boolean | null;
  merged_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  user: UserLike;
  head: { ref: string; sha: string };
  base: { ref: string };
};

export const pullSummary = (p: PullLike): PullSummary => ({
  number: p.number,
  title: p.title,
  state: pullState(p),
  author: actor(p.user),
  headRef: p.head.ref,
  headSha: p.head.sha,
  baseRef: p.base.ref,
  createdAt: p.created_at,
  updatedAt: p.updated_at,
  mergedAt: p.merged_at,
  closedAt: p.closed_at,
  url: p.html_url,
});
