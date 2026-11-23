import type { GithubClient, RepoRef } from "@agent-tracking/github";
import type { Emit } from "./app";

export type WatcherOptions = {
  /** Poll interval; 0 or less disables the timer (tests call `pollOnce`). */
  intervalMs?: number;
  /** A project stays watched this long after its last heartbeat. */
  watchTtlMs?: number;
  /** Skip a cycle when fewer requests than this remain in the rate limit. */
  minRemaining?: number;
  now?: () => number;
};

type Seen = { pulls: Map<number, string>; runs: Map<number, string> };

/**
 * Polls GitHub for the projects that are open in some UI (they send heartbeats) and emits
 * `github.changed` events when a pull request or workflow run changes state. Requests revalidate
 * with ETags, so an unchanged repository costs 304s.
 */
export class GithubWatcher {
  private watched = new Map<string, number>();
  private seen = new Map<string, Seen>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private readonly now: () => number;

  constructor(
    private readonly gh: GithubClient,
    private readonly resolveRepo: (projectId: string) => Promise<RepoRef | null>,
    private readonly emit: Emit,
    private readonly opts: WatcherOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
  }

  watch(projectId: string) {
    this.watched.set(projectId, this.now());
  }

  start() {
    const ms = this.opts.intervalMs ?? 0;
    if (ms <= 0 || this.timer) return;
    this.timer = setInterval(() => void this.pollOnce(), ms);
    // Never keep the process alive just for polling.
    (this.timer as { unref?: () => void }).unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async pollOnce() {
    if (this.polling) return;
    this.polling = true;
    try {
      const ttl = this.opts.watchTtlMs ?? 3 * 60_000;
      for (const [projectId, lastSeen] of this.watched) {
        if (this.now() - lastSeen > ttl) {
          this.watched.delete(projectId);
          this.seen.delete(projectId);
          continue;
        }
        const remaining = this.gh.rateLimit?.remaining;
        if (remaining !== undefined && remaining < (this.opts.minRemaining ?? 10)) return;
        await this.pollProject(projectId).catch(() => {
          // Errors surface when the UI reads the same data; polling just tries again next cycle.
        });
      }
    } finally {
      this.polling = false;
    }
  }

  private async pollProject(projectId: string) {
    const ref = await this.resolveRepo(projectId);
    if (!ref) return;
    const [pulls, runs] = await Promise.all([
      this.gh.listPulls(ref, "all", { revalidate: true }),
      this.gh.listRuns(ref, {}, { revalidate: true }),
    ]);
    const next: Seen = {
      pulls: new Map(pulls.map((p) => [p.number, p.state])),
      runs: new Map(runs.map((r) => [r.id, r.status])),
    };
    const prev = this.seen.get(projectId);
    this.seen.set(projectId, next);
    // The first poll only sets the baseline.
    if (!prev) return;
    // FEATURE LINK: once the MCP features table exists, resolve the feature for each changed pull
    // request (by head branch name or by the commits it contains) or run (by branch / head sha) and
    // include `featureId` in the event so the feature view can refresh as well.
    for (const [number, state] of next.pulls) {
      if (prev.pulls.get(number) !== state) this.emit({ type: "github.changed", projectId, entity: "pull", id: String(number) });
    }
    for (const [id, status] of next.runs) {
      if (prev.runs.get(id) !== status) this.emit({ type: "github.changed", projectId, entity: "run", id: String(id) });
    }
  }
}
