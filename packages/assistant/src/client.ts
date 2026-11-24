import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { claudeCliAvailable, ClaudeCliError, createClaudeCli, runClaudeCli, type ClaudeCli } from "./claude-code";

/** Everyday model for short, structured answers. */
export const DEFAULT_MODEL = "claude-sonnet-5-5";
/** Used where the answer weighs trade-offs (stack recommendation). */
export const HEAVY_MODEL = "claude-opus-5-5";

export type Effort = "low" | "medium" | "high";

/** The part of the Anthropic client the assistant uses; tests pass a client with a fake `fetch`. */
export type AssistantClient = Pick<Anthropic, "beta">;

type Models = { default: string; heavy: string };

/**
 * Where requests go: the Claude API with a key, or the local Claude Code CLI with the person's
 * own login (covered by a Pro or Max subscription).
 */
export type AssistantConfig =
  | { provider?: "api"; client: AssistantClient; models: Models }
  | { provider: "claude-code"; cli: ClaudeCli; models: Models; env?: Record<string, string | undefined> };

export type AssistantProvider = "api" | "claude-code";
export const providerOf = (config: AssistantConfig): AssistantProvider => config.provider ?? "api";

/** A failure the API layer reports as "the assistant could not answer", never with details. */
export class AssistantError extends Error {
  constructor(
    message: string,
    readonly reason: "invalid" | "refusal" | "truncated" | "api",
  ) {
    super(message);
  }
}

const modelsFromEnv = (env: Record<string, string | undefined>): Models => ({
  default: env.AGENT_TRACKING_ASSISTANT_MODEL || DEFAULT_MODEL,
  heavy: env.AGENT_TRACKING_ASSISTANT_HEAVY_MODEL || HEAVY_MODEL,
});

/**
 * Builds the API assistant from the environment. Returns null without ANTHROPIC_API_KEY, which
 * keeps every endpoint on its deterministic behaviour. The key stays inside the SDK client.
 */
export function assistantConfigFromEnv(env: Record<string, string | undefined> = process.env): AssistantConfig | null {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  return { provider: "api", client: new Anthropic({ apiKey, timeout: 90_000, maxRetries: 2 }), models: modelsFromEnv(env) };
}

/**
 * Picks the provider at startup. `AGENT_TRACKING_ASSISTANT_PROVIDER` can be `api`, `claude-code`,
 * `off` or `auto` (default): an API key wins, otherwise a logged-in local Claude Code CLI is used.
 */
export async function resolveAssistantConfig(
  env: Record<string, string | undefined> = process.env,
  cli: ClaudeCli = createClaudeCli({ bin: env.AGENT_TRACKING_CLAUDE_BIN || undefined }),
): Promise<AssistantConfig | null> {
  const wanted = (env.AGENT_TRACKING_ASSISTANT_PROVIDER ?? "auto").trim().toLowerCase();
  if (wanted === "off") return null;
  if (wanted !== "claude-code") {
    const api = assistantConfigFromEnv(env);
    if (api || wanted === "api") return api;
  }
  if (await claudeCliAvailable(cli, env)) return { provider: "claude-code", cli, models: modelsFromEnv(env), env };
  return null;
}

type AskParams<S extends z.ZodType> = {
  model: string;
  effort: Effort;
  system: string;
  prompt: string;
  schema: S;
};

/** One structured request; the answer is always validated against the zod schema. */
export async function ask<S extends z.ZodType>(config: AssistantConfig, params: AskParams<S>): Promise<z.infer<S>> {
  if (config.provider === "claude-code") return askClaudeCode(config, params);
  let response;
  try {
    response = await config.client.beta.messages.parse({
      model: params.model,
      max_tokens: 16000,
      // A refused request is retried by the API on a suitable model instead of failing.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: params.effort, format: betaZodOutputFormat(params.schema) },
      system: params.system,
      messages: [{ role: "user", content: params.prompt }],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) throw new AssistantError(`Claude API ${error.status ?? "sin respuesta"}`, "api");
    // Thrown by parse() when the JSON does not match the schema.
    if (error instanceof Anthropic.AnthropicError) throw new AssistantError("Respuesta con formato inválido", "invalid");
    throw error;
  }
  if (response.stop_reason === "refusal") throw new AssistantError("El modelo rechazó la solicitud", "refusal");
  if (response.stop_reason === "max_tokens") throw new AssistantError("Respuesta incompleta", "truncated");
  if (response.parsed_output == null) throw new AssistantError("Respuesta sin datos", "invalid");
  return response.parsed_output as z.infer<S>;
}

async function askClaudeCode<S extends z.ZodType>(
  config: Extract<AssistantConfig, { provider: "claude-code" }>,
  params: AskParams<S>,
): Promise<z.infer<S>> {
  let output: unknown;
  try {
    output = await runClaudeCli(
      config.cli,
      {
        model: params.model,
        effort: params.effort,
        system: params.system,
        prompt: params.prompt,
        jsonSchema: z.toJSONSchema(params.schema, { target: "draft-7" }) as Record<string, unknown>,
      },
      config.env,
    );
  } catch (error) {
    if (error instanceof ClaudeCliError) throw new AssistantError(error.message, error.reason === "invalid" ? "invalid" : "api");
    throw error;
  }
  const parsed = params.schema.safeParse(output);
  if (!parsed.success) throw new AssistantError("Respuesta con formato inválido", "invalid");
  return parsed.data;
}

/** Short, safe description for server logs (no headers, no request bodies). */
export const describeAssistantError = (error: unknown) =>
  error instanceof AssistantError ? `${error.reason}: ${error.message}` : error instanceof Error ? error.name : "unknown";
