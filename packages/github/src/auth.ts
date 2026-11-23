/**
 * Authentication is pluggable: anything that implements `AuthProvider` can feed the client.
 * Today there is a personal token (env or gh CLI); a GitHub App (installation tokens) or an OAuth
 * flow can be added later as new providers without touching the client or the routes.
 */

export type AuthSource = "env" | "gh-cli" | "app" | "oauth";

export type GithubAuth =
  | { kind: "token"; source: AuthSource; token: string }
  | { kind: "anonymous" };

/** Public view of the auth state: never includes the token. */
export type AuthInfo = { kind: "token"; source: AuthSource } | { kind: "anonymous" };

export interface AuthProvider {
  /** Returns the credentials to use now. May be called again (e.g. after a 401) to refresh. */
  resolve(): Promise<GithubAuth>;
}

export const describeAuth = (auth: GithubAuth): AuthInfo =>
  auth.kind === "token" ? { kind: "token", source: auth.source } : { kind: "anonymous" };

type Spawn = (cmd: string[]) => Promise<{ ok: boolean; stdout: string }>;

const spawnQuiet: Spawn = async (cmd) => {
  try {
    const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "ignore", stdin: "ignore" });
    const timer = setTimeout(() => proc.kill(), 5_000);
    const [stdout, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    clearTimeout(timer);
    return { ok: code === 0, stdout: stdout.trim() };
  } catch {
    // gh is not installed.
    return { ok: false, stdout: "" };
  }
};

/** `GITHUB_TOKEN`, then `gh auth token` when gh is installed and logged in, else anonymous. */
export const tokenAuthProvider = (opts: { env?: Record<string, string | undefined>; spawn?: Spawn } = {}): AuthProvider => ({
  async resolve() {
    const env = opts.env ?? process.env;
    const fromEnv = env.GITHUB_TOKEN?.trim();
    if (fromEnv) return { kind: "token", source: "env", token: fromEnv };
    const gh = await (opts.spawn ?? spawnQuiet)(["gh", "auth", "token", "--hostname", "github.com"]);
    if (gh.ok && gh.stdout) return { kind: "token", source: "gh-cli", token: gh.stdout };
    return { kind: "anonymous" };
  },
});

export const staticAuthProvider = (auth: GithubAuth): AuthProvider => ({ resolve: async () => auth });
