import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Shared plumbing for the CLI providers (Claude Code, Codex CLI, Gemini CLI). */

export type SpawnResult = { code: number; stdout: string; stderr: string };
export type Spawn = (cmd: string[], opts: { cwd: string; stdin: string; env: Record<string, string | undefined>; timeoutMs: number }) => Promise<SpawnResult>;

export type Queue = { run: <T>(task: () => Promise<T>) => Promise<T> };

export const defaultSpawn: Spawn = async (cmd, { cwd, stdin, env, timeoutMs }) => {
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

/** Requests run one after another so a burst of clicks does not start many CLI processes. */
export const serialQueue = (): Queue => {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run: <T>(task: () => Promise<T>) => {
      const next = tail.then(task, task);
      tail = next.catch(() => {});
      return next;
    },
  };
};

const emptyDirs = new Map<string, Promise<string>>();
/** An empty working directory per CLI, so no project instructions or settings are picked up. */
export const isolatedCwd = (name: string) => {
  let dir = emptyDirs.get(name);
  if (!dir) emptyDirs.set(name, (dir = mkdtemp(join(tmpdir(), `agent-tracking-${name}-`))));
  return dir;
};

/** A fresh directory for one request's files (schema, system prompt, answer). */
export const requestDir = (name: string) => mkdtemp(join(tmpdir(), `agent-tracking-${name}-req-`));

/** The JSON object in a model's text answer, tolerating a surrounding markdown code fence. */
export function parseJsonText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/i.exec(trimmed);
  return JSON.parse(fenced ? fenced[1]! : trimmed);
}
