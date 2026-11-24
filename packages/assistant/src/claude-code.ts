import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Runs the assistant through the locally installed Claude Code CLI (`claude -p`) with the person's
 * own login, so a Claude Pro or Max subscription covers the requests. Intended for personal use on
 * the person's own machine; distributed installs should use an API key per user.
 */

export type SpawnResult = { code: number; stdout: string; stderr: string };
export type Spawn = (cmd: string[], opts: { cwd: string; stdin: string; env: Record<string, string | undefined>; timeoutMs: number }) => Promise<SpawnResult>;

export type ClaudeCli = {
  bin: string;
  spawn: Spawn;
  timeoutMs: number;
  /** Requests run one after another so a burst of clicks does not start many CLI processes. */
  queue: { run: <T>(task: () => Promise<T>) => Promise<T> };
};

export type CliRequest = {
  model: string;
  effort: "low" | "medium" | "high";
  system: string;
  prompt: string;
  jsonSchema: Record<string, unknown>;
};

export class ClaudeCliError extends Error {
  constructor(
    message: string,
    readonly reason: "unavailable" | "failed" | "invalid",
  ) {
    super(message);
  }
}

const defaultSpawn: Spawn = async (cmd, { cwd, stdin, env, timeoutMs }) => {
  const proc = Bun.spawn(cmd, { cwd, env, stdin: new Blob([stdin]), stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => proc.kill(), timeoutMs);
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timer);
  return { code, stdout, stderr };
};

const serialQueue = (): ClaudeCli["queue"] => {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run: <T>(task: () => Promise<T>) => {
      const next = tail.then(task, task);
      tail = next.catch(() => {});
      return next;
    },
  };
};

/**
 * Environment for the child process. Markers of a parent Claude Code session are removed so the
 * CLI does not treat itself as nested; credentials (login, OAuth token) are left untouched.
 */
const childEnv = (env: Record<string, string | undefined>) => {
  const { CLAUDECODE: _a, CLAUDE_CODE_ENTRYPOINT: _b, ANTHROPIC_API_KEY: _c, ...rest } = env;
  return rest;
};

let emptyDir: Promise<string> | undefined;
/** An empty working directory, so no CLAUDE.md or project settings are picked up. */
const isolatedCwd = () => (emptyDir ??= mkdtemp(join(tmpdir(), "agent-tracking-claude-")));

export function createClaudeCli(opts: { bin?: string; spawn?: Spawn; timeoutMs?: number } = {}): ClaudeCli {
  return {
    bin: opts.bin ?? "claude",
    spawn: opts.spawn ?? defaultSpawn,
    timeoutMs: opts.timeoutMs ?? 180_000,
    queue: serialQueue(),
  };
}

/** True when the CLI is installed and logged in (`claude auth status`). */
export async function claudeCliAvailable(cli: ClaudeCli, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  try {
    const res = await cli.spawn([cli.bin, "auth", "status"], {
      cwd: await isolatedCwd(),
      stdin: "",
      env: childEnv(env),
      timeoutMs: 15_000,
    });
    if (res.code !== 0) return false;
    const status = JSON.parse(res.stdout);
    return status?.loggedIn === true;
  } catch {
    // Not installed, or the output is not the expected JSON.
    return false;
  }
}

/** Arguments for one structured, tool-less request. Exported for tests. */
export const cliArgs = (bin: string, req: CliRequest) => [
  bin,
  "-p",
  "--output-format",
  "json",
  "--json-schema",
  JSON.stringify(req.jsonSchema),
  // No tools and no MCP servers: the CLI only answers, it never reads or changes files.
  "--tools",
  "",
  "--strict-mcp-config",
  "--no-session-persistence",
  "--model",
  req.model,
  "--effort",
  req.effort,
  "--system-prompt",
  req.system,
];

/** Sends one request and returns the structured output (not yet validated against the zod schema). */
export async function runClaudeCli(cli: ClaudeCli, req: CliRequest, env: Record<string, string | undefined> = process.env): Promise<unknown> {
  return cli.queue.run(async () => {
    let res: SpawnResult;
    try {
      res = await cli.spawn(cliArgs(cli.bin, req), {
        cwd: await isolatedCwd(),
        stdin: req.prompt,
        env: childEnv(env),
        timeoutMs: cli.timeoutMs,
      });
    } catch {
      throw new ClaudeCliError("No se encontró el comando claude", "unavailable");
    }
    let out: Record<string, unknown>;
    try {
      out = JSON.parse(res.stdout);
    } catch {
      throw new ClaudeCliError(res.code === 0 ? "Respuesta de Claude Code ilegible" : "Claude Code terminó con error", "failed");
    }
    if (out.is_error === true || out.subtype !== "success") {
      throw new ClaudeCliError(`Claude Code no pudo responder (${String(out.subtype ?? "error")})`, "failed");
    }
    if (out.structured_output == null) throw new ClaudeCliError("Claude Code respondió sin datos", "invalid");
    return out.structured_output;
  });
}
