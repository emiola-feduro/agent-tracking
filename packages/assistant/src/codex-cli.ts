import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AssistantError } from "./errors";
import { bareSchema, type JsonRequest } from "./openai";
import { defaultSpawn, isolatedCwd, requestDir, serialQueue, type Queue, type Spawn, type SpawnResult } from "./spawn";

/**
 * Runs the assistant through the locally installed Codex CLI (`codex exec`) with the person's own
 * login (ChatGPT plan or API key). `--output-schema` constrains the final message to the JSON
 * Schema and `-o` writes that message to a file, which is read back as the answer.
 */

/** A local CLI: binary, how to start it (injectable for tests), timeout and a one-at-a-time queue. */
export type CliTool = { bin: string; spawn: Spawn; timeoutMs: number; queue: Queue };

export const createCliTool = (defaultBin: string, opts: { bin?: string; spawn?: Spawn; timeoutMs?: number } = {}): CliTool => ({
  bin: opts.bin ?? defaultBin,
  spawn: opts.spawn ?? defaultSpawn,
  timeoutMs: opts.timeoutMs ?? 180_000,
  queue: serialQueue(),
});

export const createCodexCli = (opts: { bin?: string; spawn?: Spawn; timeoutMs?: number } = {}) => createCliTool("codex", opts);

/** True when the CLI is installed and has credentials (`codex login status` exits with 0). */
export async function codexCliAvailable(cli: CliTool, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  try {
    const res = await cli.spawn([cli.bin, "login", "status"], { cwd: await isolatedCwd("codex"), stdin: "", env, timeoutMs: 15_000 });
    return res.code === 0;
  } catch {
    return false;
  }
}

/** Arguments for one read-only, structured request; the prompt goes on stdin (`-`). Exported for tests. */
export const codexArgs = (bin: string, req: JsonRequest, files: { schema: string; answer: string }) => [
  bin,
  "exec",
  "-",
  "--output-schema",
  files.schema,
  "--output-last-message",
  files.answer,
  // It only answers: no writes, no session files, no user config (MCP servers, profiles) or rules.
  "--sandbox",
  "read-only",
  "--ephemeral",
  "--skip-git-repo-check",
  "--ignore-user-config",
  "--ignore-rules",
  "--color",
  "never",
  "-c",
  `model_reasoning_effort=${JSON.stringify(req.effort)}`,
  "-c",
  // A JSON string is a valid TOML basic string.
  `developer_instructions=${JSON.stringify(req.system)}`,
  ...(req.model ? ["--model", req.model] : []),
];

/** Sends one request; returns the parsed JSON answer, not yet validated against the zod schema. */
export async function runCodexCli(cli: CliTool, req: JsonRequest, env: Record<string, string | undefined> = process.env): Promise<unknown> {
  return cli.queue.run(async () => {
    const dir = await requestDir("codex");
    const files = { schema: join(dir, "schema.json"), answer: join(dir, "answer.json") };
    try {
      await writeFile(files.schema, JSON.stringify(bareSchema(req.jsonSchema)));
      let res: SpawnResult;
      try {
        res = await cli.spawn(codexArgs(cli.bin, req, files), { cwd: await isolatedCwd("codex"), stdin: req.prompt, env, timeoutMs: cli.timeoutMs });
      } catch {
        throw new AssistantError("No se encontró el comando codex", "api");
      }
      if (res.code !== 0) throw new AssistantError("Codex CLI terminó con error", "api");
      const text = await readFile(files.answer, "utf8").catch(() => res.stdout);
      if (!text.trim()) throw new AssistantError("Codex CLI respondió sin datos", "invalid");
      try {
        return JSON.parse(text);
      } catch {
        throw new AssistantError("Respuesta con formato inválido", "invalid");
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}
