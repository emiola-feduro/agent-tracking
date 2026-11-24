/** Normalized GitHub data returned by this package. Plain JSON, safe to send to the UI. */

export type RepoRef = { owner: string; repo: string };

export type PullState = "open" | "draft" | "merged" | "closed";
export type PullFilter = "open" | "closed" | "merged" | "all";

/** Unified status for workflow runs, jobs, steps and checks. */
export type RunStatus = "running" | "success" | "failure" | "cancelled" | "skipped" | "neutral";

export type Actor = { login: string; avatarUrl: string | null } | null;

export type PullSummary = {
  number: number;
  title: string;
  state: PullState;
  author: Actor;
  headRef: string;
  headSha: string;
  baseRef: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  url: string;
};

export type PullFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  url: string;
};

export type PullReview = {
  id: number;
  author: Actor;
  state: "approved" | "changes_requested" | "commented" | "dismissed" | "pending";
  body: string;
  submittedAt: string | null;
  url: string;
};

export type PullComment = {
  id: number;
  author: Actor;
  body: string;
  createdAt: string;
  /** Set for inline review comments. */
  path: string | null;
  url: string;
};

export type Check = {
  id: string;
  name: string;
  status: RunStatus;
  url: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type PullDetail = PullSummary & {
  body: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  files: PullFile[];
  reviews: PullReview[];
  comments: PullComment[];
  checks: Check[];
  checksStatus: RunStatus | null;
};

export type BranchSummary = {
  name: string;
  isDefault: boolean;
  protected: boolean;
  sha: string;
  /** Null when the commit was not looked up (rate limit budget). */
  commit: { message: string; author: string | null; date: string | null; url: string } | null;
  pull: { number: number; state: PullState; url: string } | null;
  url: string;
};

export type Workflow = { id: number; name: string; path: string; state: string; url: string };

export type WorkflowRun = {
  id: number;
  name: string;
  workflowId: number;
  title: string;
  branch: string | null;
  sha: string;
  event: string;
  status: RunStatus;
  runNumber: number;
  attempt: number;
  actor: Actor;
  createdAt: string;
  updatedAt: string;
  url: string;
};

export type JobStep = { number: number; name: string; status: RunStatus; startedAt: string | null; completedAt: string | null };

export type Job = {
  id: number;
  name: string;
  status: RunStatus;
  startedAt: string | null;
  completedAt: string | null;
  /** GitHub page for the job, which shows its logs. */
  url: string;
  steps: JobStep[];
};

export type RunDetail = WorkflowRun & { jobs: Job[] };

export type RateLimit = { limit: number; remaining: number; used: number; resetAt: string; resource: string };
