import type { RateLimit } from "./types";

type Entry = { etag: string | null; body: string; headers: [string, string][]; storedAt: number; ttlMs: number };

export type CacheOptions = {
  /** How long a GET response is served without asking GitHub again. */
  ttlMs?: number;
  /** Maximum cached responses (oldest are evicted first). */
  maxEntries?: number;
  now?: () => number;
};

/** Requests carrying this header skip the TTL and revalidate with the ETag (used by the poller). */
export const REVALIDATE_HEADER = "x-agent-tracking-revalidate";

// Commits addressed by full sha never change.
const IMMUTABLE = /\/commits\/[0-9a-f]{40}$/;

const KEPT_HEADERS = ["content-type", "link", "etag"];

/**
 * Wraps `fetch` with an in-memory cache for GitHub GET requests:
 * fresh entries are served locally; stale ones are revalidated with `If-None-Match`, and a 304
 * (which does not spend the rate limit) returns the cached body. Also records the rate limit.
 */
export class CachedFetch {
  private entries = new Map<string, Entry>();
  private inflight = new Map<string, Promise<Response>>();
  rateLimit: RateLimit | null = null;
  readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(
    private readonly inner: typeof fetch,
    opts: CacheOptions = {},
  ) {
    this.ttlMs = opts.ttlMs ?? 30_000;
    this.maxEntries = opts.maxEntries ?? 1_000;
    this.now = opts.now ?? Date.now;
  }

  clear() {
    this.entries.clear();
  }

  get size() {
    return this.entries.size;
  }

  readonly fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const method = (init.method ?? "GET").toUpperCase();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init.headers);
    const revalidate = headers.has(REVALIDATE_HEADER);
    headers.delete(REVALIDATE_HEADER);
    if (method !== "GET") return this.send(url, { ...init, headers });

    const cached = this.entries.get(url);
    if (cached && !revalidate && this.now() - cached.storedAt < cached.ttlMs) return this.replay(url, cached);

    // Concurrent identical GETs share one network request.
    const pending = this.inflight.get(url);
    if (pending) return (await pending).clone();
    const promise = this.revalidate(url, init, headers, cached);
    this.inflight.set(url, promise);
    try {
      return (await promise).clone();
    } finally {
      this.inflight.delete(url);
    }
  };

  private async revalidate(url: string, init: RequestInit, headers: Headers, cached: Entry | undefined) {
    if (cached?.etag) headers.set("if-none-match", cached.etag);
    const res = await this.send(url, { ...init, headers });
    if (res.status === 304 && cached) {
      cached.storedAt = this.now();
      return this.replay(url, cached);
    }
    if (res.status !== 200) return res;
    const body = await res.text();
    const entry: Entry = {
      etag: res.headers.get("etag"),
      body,
      headers: KEPT_HEADERS.flatMap((h) => (res.headers.has(h) ? [[h, res.headers.get(h)!] as [string, string]] : [])),
      storedAt: this.now(),
      ttlMs: IMMUTABLE.test(new URL(url).pathname) ? Number.POSITIVE_INFINITY : this.ttlMs,
    };
    this.entries.delete(url);
    this.entries.set(url, entry);
    if (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
    return this.replay(url, entry);
  }

  private replay(url: string, entry: Entry) {
    // Refresh recency for eviction.
    this.entries.delete(url);
    this.entries.set(url, entry);
    return new Response(entry.body, { status: 200, headers: entry.headers });
  }

  private async send(url: string, init: RequestInit) {
    const res = await this.inner(url, init);
    this.recordRateLimit(res.headers);
    return res;
  }

  private recordRateLimit(h: Headers) {
    const remaining = h.get("x-ratelimit-remaining");
    const resource = h.get("x-ratelimit-resource") ?? "core";
    // Only track the REST "core" budget; search and graphql have their own.
    if (remaining === null || resource !== "core") return;
    this.rateLimit = {
      limit: Number(h.get("x-ratelimit-limit") ?? 0),
      remaining: Number(remaining),
      used: Number(h.get("x-ratelimit-used") ?? 0),
      resetAt: new Date(Number(h.get("x-ratelimit-reset") ?? 0) * 1000).toISOString(),
      resource,
    };
  }
}
