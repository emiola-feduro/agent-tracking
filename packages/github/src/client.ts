import { Octokit } from "@octokit/rest";
import { describeAuth, tokenAuthProvider, type AuthInfo, type AuthProvider, type GithubAuth } from "./auth";
import { CachedFetch, REVALIDATE_HEADER } from "./cache";
import { toGithubError } from "./errors";
import { actor, aggregateStatus, commitStatus, pullSummary, runStatus } from "./normalize";
import type {
  BranchSummary,
  Check,
  Job,
  PullDetail,
  PullFilter,
  PullReview,
  PullSummary,
  RateLimit,
  RepoRef,
  RunDetail,
  Workflow,
  WorkflowRun,
} from "./types";

export type GithubClientOptions = {
  auth?: AuthProvider;
  /** Injected in tests to answer without network. */
  fetch?: typeof fetch;
  ttlMs?: number;
  /** Max commit lookups per branch listing (each one may cost a request on a cold cache). */
  commitLookups?: { token: number; anonymous: number };
};

export type ReadOptions = { revalidate?: boolean };

const silent = { debug() {}, info() {}, warn() {}, error() {} };
const PAGE = 100;

export class GithubClient {
  private readonly cache: CachedFetch;
  private readonly authProvider: AuthProvider;
  private session: Promise<{ auth: GithubAuth; octokit: Octokit }> | null = null;
  private readonly commitLookups: { token: number; anonymous: number };

  constructor(opts: GithubClientOptions = {}) {
    this.cache = new CachedFetch(opts.fetch ?? fetch, { ttlMs: opts.ttlMs });
    this.authProvider = opts.auth ?? tokenAuthProvider();
    this.commitLookups = opts.commitLookups ?? { token: 60, anonymous: 15 };
  }

  private connect() {
    this.session ??= this.authProvider.resolve().then((auth) => ({
      auth,
      octokit: new Octokit({
        auth: auth.kind === "token" ? auth.token : undefined,
        userAgent: "agent-tracking",
        log: silent,
        request: { fetch: this.cache.fetch },
      }),
    }));
    return this.session;
  }

  /** Re-reads the credentials (e.g. after `gh auth login`) and drops responses cached with the old ones. */
  async refreshAuth(): Promise<AuthInfo> {
    this.session = null;
    this.cache.clear();
    this.cache.rateLimit = null;
    return this.authInfo();
  }

  async authInfo(): Promise<AuthInfo> {
    return describeAuth((await this.connect()).auth);
  }

  get rateLimit(): RateLimit | null {
    return this.cache.rateLimit;
  }

  /** The last known rate limit, asking GitHub when none is known yet (`/rate_limit` is free). */
  async currentRateLimit(): Promise<RateLimit | null> {
    if (!this.cache.rateLimit) await this.run((o) => o.rateLimit.get()).catch(() => {});
    return this.cache.rateLimit;
  }

  private async run<T>(fn: (o: Octokit, auth: GithubAuth) => Promise<T>): Promise<T> {
    const { octokit, auth } = await this.connect();
    try {
      return await fn(octokit, auth);
    } catch (e) {
      const err = toGithubError(e);
      // A revoked token: resolve credentials again on the next call.
      if (err.code === "unauthorized" && auth.kind === "token") this.session = null;
      throw err;
    }
  }

  private headers(opts?: ReadOptions) {
    return opts?.revalidate ? { [REVALIDATE_HEADER]: "1" } : {};
  }

  async defaultBranch({ owner, repo }: RepoRef): Promise<string> {
    return this.run(async (o) => (await o.repos.get({ owner, repo })).data.default_branch);
  }

  async listPulls({ owner, repo }: RepoRef, filter: PullFilter = "open", opts?: ReadOptions): Promise<PullSummary[]> {
    return this.run(async (o) => {
      const { data } = await o.pulls.list({
        owner,
        repo,
        state: filter === "merged" ? "closed" : filter,
        sort: "updated",
        direction: "desc",
        per_page: filter === "open" ? PAGE : 50,
        headers: this.headers(opts),
      });
      const pulls = data.map(pullSummary);
      if (filter === "merged") return pulls.filter((p) => p.state === "merged");
      if (filter === "closed") return pulls.filter((p) => p.state === "closed");
      return pulls;
    });
  }

  async getPull({ owner, repo }: RepoRef, number: number): Promise<PullDetail> {
    return this.run(async (o) => {
      const { data: pr } = await o.pulls.get({ owner, repo, pull_number: number });
      const ref = pr.head.sha;
      const [files, reviews, comments, reviewComments, checkRuns, statuses] = await Promise.all([
        o.pulls.listFiles({ owner, repo, pull_number: number, per_page: PAGE }),
        o.pulls.listReviews({ owner, repo, pull_number: number, per_page: PAGE }),
        o.issues.listComments({ owner, repo, issue_number: number, per_page: PAGE }),
        o.pulls.listReviewComments({ owner, repo, pull_number: number, per_page: PAGE }),
        o.checks.listForRef({ owner, repo, ref, per_page: PAGE }),
        o.repos.getCombinedStatusForRef({ owner, repo, ref }),
      ]);
      const checks: Check[] = [
        ...checkRuns.data.check_runs.map((c) => ({
          id: `check-${c.id}`,
          name: c.name,
          status: runStatus(c.status, c.conclusion),
          url: c.html_url ?? c.details_url ?? null,
          startedAt: c.started_at ?? null,
          completedAt: c.completed_at ?? null,
        })),
        ...statuses.data.statuses.map((s) => ({
          id: `status-${s.id}`,
          name: s.context,
          status: commitStatus(s.state),
          url: s.target_url ?? null,
          startedAt: s.created_at,
          completedAt: s.state === "pending" ? null : s.updated_at,
        })),
      ];
      return {
        ...pullSummary(pr),
        body: pr.body ?? "",
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files,
        commits: pr.commits,
        files: files.data.map((f) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          url: `${pr.html_url}/files`,
        })),
        reviews: reviews.data.map((r) => ({
          id: r.id,
          author: actor(r.user),
          state: r.state.toLowerCase() as PullReview["state"],
          body: r.body ?? "",
          submittedAt: r.submitted_at ?? null,
          url: r.html_url,
        })),
        comments: [
          ...comments.data.map((c) => ({
            id: c.id,
            author: actor(c.user),
            body: c.body ?? "",
            createdAt: c.created_at,
            path: null,
            url: c.html_url,
          })),
          ...reviewComments.data.map((c) => ({
            id: c.id,
            author: actor(c.user),
            body: c.body,
            createdAt: c.created_at,
            path: c.path,
            url: c.html_url,
          })),
        ].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        checks,
        checksStatus: aggregateStatus(checks.map((c) => c.status)),
      };
    });
  }

  /**
   * Remote branches with their last commit and pull request. Commits are looked up by sha (cached
   * forever), within a per-call budget so an anonymous listing cannot burn the hourly limit.
   */
  async listBranches(ref: RepoRef): Promise<BranchSummary[]> {
    const { owner, repo } = ref;
    const [defaultBranch, pulls] = await Promise.all([this.defaultBranch(ref), this.listPulls(ref, "all")]);
    return this.run(async (o, auth) => {
      const { data } = await o.repos.listBranches({ owner, repo, per_page: PAGE });
      const prFor = (name: string) => {
        const matches = pulls.filter((p) => p.headRef === name);
        return matches.find((p) => p.state === "open" || p.state === "draft") ?? matches[0] ?? null;
      };
      const budget = auth.kind === "token" ? this.commitLookups.token : this.commitLookups.anonymous;
      // Default branch and branches with pull requests get their commit first.
      const priority = [...data].sort((a, b) => rank(b) - rank(a));
      function rank(b: { name: string }) {
        return (b.name === defaultBranch ? 2 : 0) + (prFor(b.name) ? 1 : 0);
      }
      const lookup = new Set(priority.slice(0, budget).map((b) => b.name));
      const branches = await Promise.all(
        data.map(async (b): Promise<BranchSummary> => {
          const pull = prFor(b.name);
          let commit: BranchSummary["commit"] = null;
          if (lookup.has(b.name)) {
            const { data: c } = await o.git.getCommit({ owner, repo, commit_sha: b.commit.sha });
            commit = {
              message: c.message.split("\n")[0] ?? "",
              author: c.author?.name ?? null,
              date: c.committer?.date ?? c.author?.date ?? null,
              url: `https://github.com/${owner}/${repo}/commit/${b.commit.sha}`,
            };
          }
          return {
            name: b.name,
            isDefault: b.name === defaultBranch,
            protected: b.protected,
            sha: b.commit.sha,
            commit,
            pull: pull && { number: pull.number, state: pull.state, url: pull.url },
            url: `https://github.com/${owner}/${repo}/tree/${encodeURIComponent(b.name)}`,
          };
        }),
      );
      return branches.sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        const da = a.commit?.date ?? "";
        const db = b.commit?.date ?? "";
        return db.localeCompare(da) || a.name.localeCompare(b.name);
      });
    });
  }

  /** Commits `branch` has that `base` does not: what deleting it on GitHub would lose. */
  async commitsAhead({ owner, repo }: RepoRef, base: string, branch: string): Promise<number> {
    return this.run(async (o) => {
      const { data } = await o.repos.compareCommitsWithBasehead({ owner, repo, basehead: `${base}...${branch}`, per_page: 1 });
      return data.ahead_by;
    });
  }

  /** Deletes a branch on GitHub. Cached listings are dropped so the next read shows it gone. */
  async deleteBranch({ owner, repo }: RepoRef, branch: string): Promise<void> {
    await this.run(async (o) => {
      // The ref keeps its slashes (feat/x): Octokit's {ref} parameter would encode them.
      const path = branch.split("/").map(encodeURIComponent).join("/");
      await o.request(`DELETE /repos/{owner}/{repo}/git/refs/heads/${path}`, { owner, repo });
    });
    this.cache.clear();
  }

  async listWorkflows({ owner, repo }: RepoRef): Promise<Workflow[]> {
    return this.run(async (o) => {
      const { data } = await o.actions.listRepoWorkflows({ owner, repo, per_page: PAGE });
      return data.workflows.map((w) => ({ id: w.id, name: w.name, path: w.path, state: w.state, url: w.html_url }));
    });
  }

  async listRuns(
    { owner, repo }: RepoRef,
    filter: { branch?: string; workflowId?: number } = {},
    opts?: ReadOptions,
  ): Promise<WorkflowRun[]> {
    return this.run(async (o) => {
      const common = { owner, repo, per_page: 30, branch: filter.branch || undefined, headers: this.headers(opts) };
      const { data } = filter.workflowId
        ? await o.actions.listWorkflowRuns({ ...common, workflow_id: filter.workflowId })
        : await o.actions.listWorkflowRunsForRepo(common);
      return data.workflow_runs.map(toRun);
    });
  }

  async getRun({ owner, repo }: RepoRef, runId: number): Promise<RunDetail> {
    return this.run(async (o) => {
      const [run, jobs] = await Promise.all([
        o.actions.getWorkflowRun({ owner, repo, run_id: runId }),
        o.actions.listJobsForWorkflowRun({ owner, repo, run_id: runId, per_page: PAGE }),
      ]);
      return {
        ...toRun(run.data),
        jobs: jobs.data.jobs.map(
          (j): Job => ({
            id: j.id,
            name: j.name,
            status: runStatus(j.status, j.conclusion),
            startedAt: j.started_at ?? null,
            completedAt: j.completed_at ?? null,
            url: j.html_url ?? `${run.data.html_url}/job/${j.id}`,
            steps: (j.steps ?? []).map((s) => ({
              number: s.number,
              name: s.name,
              status: runStatus(s.status, s.conclusion),
              startedAt: s.started_at ?? null,
              completedAt: s.completed_at ?? null,
            })),
          }),
        ),
      };
    });
  }
}

type RunLike = {
  id: number;
  name?: string | null;
  workflow_id: number;
  display_title: string;
  head_branch: string | null;
  head_sha: string;
  event: string;
  status: string | null;
  conclusion: string | null;
  run_number: number;
  run_attempt?: number;
  actor?: { login: string; avatar_url?: string | null } | null;
  created_at: string;
  updated_at: string;
  html_url: string;
};

const toRun = (r: RunLike): WorkflowRun => ({
  id: r.id,
  name: r.name ?? "",
  workflowId: r.workflow_id,
  title: r.display_title,
  branch: r.head_branch,
  sha: r.head_sha,
  event: r.event,
  status: runStatus(r.status, r.conclusion),
  runNumber: r.run_number,
  attempt: r.run_attempt ?? 1,
  actor: actor(r.actor),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  url: r.html_url,
});
