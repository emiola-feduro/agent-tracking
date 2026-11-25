import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCliTool, type CliTool } from "./codex-cli";
import { AssistantError } from "./errors";
import { bareSchema, type JsonRequest } from "./openai";
import { isolatedCwd, parseJsonText, requestDir, type Spawn, type SpawnResult } from "./spawn";

/**
 * Runs the assistant through the locally installed Gemini CLI in headless mode (`gemini -p` with
 * `--output-format json`) with the person's own login or GEMINI_API_KEY. The CLI has no schema
 * flag, so the schema travels in the prompt and the answer is parsed and validated here.
 */

export const createGeminiCli = (opts: { bin?: string; spawn?: Spawn; timeoutMs?: number } = {}) => createCliTool("gemini", opts);

/** True when the CLI is installed. It has no status command; a missing login fails on the first request. */
export async function geminiCliAvailable(cli: CliTool, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  try {
    const res = await cli.spawn([cli.bin, "--version"], { cwd: await isolatedCwd("gemini"), stdin: "", env, timeoutMs: 15_000 });
    return res.code === 0;
  } catch {
    return false;
  }
}

/** The request as stdin: the prompt, then the schema the answer must follow. Exported for tests. */
export const geminiCliPrompt = (req: JsonRequest) =>
  `${req.prompt}\n\nAnswer with one JSON object that matches this JSON Schema, with no code fences and no other text:\n${JSON.stringify(bareSchema(req.jsonSchema))}`;

/** Arguments for one headless request; `-p` is appended to the stdin prompt. Exported for tests. */
export const geminiCliArgs = (bin: string, req: JsonRequest) => [
  bin,
  "-p",
  "Reply now with the JSON object only.",
  "--output-format",
  "json",
  // Read-only mode: the CLI only answers, it never edits files or runs commands.
  "--approval-mode",
  "plan",
  ...(req.model ? ["--model", req.model] : []),
];

/** Sends one request; returns the parsed JSON answer, not yet validated against the zod schema. */
export async function runGeminiCli(cli: CliTool, req: JsonRequest, env: Record<string, string | undefined> = process.env): Promise<unknown> {
  return cli.queue.run(async () => {
    const dir = await requestDir("gemini");
    // GEMINI_SYSTEM_MD replaces the CLI's built-in system prompt with this file.
    const systemFile = join(dir, "system.md");
    try {
      await writeFile(systemFile, req.system);
      let res: SpawnResult;
      try {
        res = await cli.spawn(geminiCliArgs(cli.bin, req), {
          cwd: await isolatedCwd("gemini"),
          stdin: geminiCliPrompt(req),
          env: { ...env, GEMINI_SYSTEM_MD: systemFile },
          timeoutMs: cli.timeoutMs,
        });
      } catch {
        throw new AssistantError("No se encontró el comando gemini", "api");
      }
      let out: { response?: unknown; error?: unknown };
      try {
        out = JSON.parse(res.stdout);
      } catch {
        throw new AssistantError(res.code === 0 ? "Respuesta de Gemini CLI ilegible" : "Gemini CLI terminó con error", "api");
      }
      if (res.code !== 0 || out.error) throw new AssistantError("Gemini CLI no pudo responder", "api");
      if (typeof out.response !== "string" || !out.response.trim()) throw new AssistantError("Gemini CLI respondió sin datos", "invalid");
      try {
        return parseJsonText(out.response);
      } catch {
        throw new AssistantError("Respuesta con formato inválido", "invalid");
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}
