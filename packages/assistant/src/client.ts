import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

/** Everyday model for short, structured answers. */
export const DEFAULT_MODEL = "claude-sonnet-5-5";
/** Used where the answer weighs trade-offs (stack recommendation). */
export const HEAVY_MODEL = "claude-opus-5-5";

export type Effort = "low" | "medium" | "high";

/** The part of the Anthropic client the assistant uses; tests pass a client with a fake `fetch`. */
export type AssistantClient = Pick<Anthropic, "beta">;

export type AssistantConfig = {
  client: AssistantClient;
  models: { default: string; heavy: string };
};

/** A failure the API layer reports as "the assistant could not answer", never with details. */
export class AssistantError extends Error {
  constructor(
    message: string,
    readonly reason: "invalid" | "refusal" | "truncated" | "api",
  ) {
    super(message);
  }
}

/**
 * Builds the assistant from the environment. Returns null without ANTHROPIC_API_KEY, which keeps
 * every endpoint on its deterministic behaviour. The key stays inside the SDK client.
 */
export function assistantConfigFromEnv(env: Record<string, string | undefined> = process.env): AssistantConfig | null {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    client: new Anthropic({ apiKey, timeout: 90_000, maxRetries: 2 }),
    models: {
      default: env.AGENT_TRACKING_ASSISTANT_MODEL || DEFAULT_MODEL,
      heavy: env.AGENT_TRACKING_ASSISTANT_HEAVY_MODEL || HEAVY_MODEL,
    },
  };
}

type AskParams<S extends z.ZodType> = {
  model: string;
  effort: Effort;
  system: string;
  prompt: string;
  schema: S;
};

/** One structured request: the SDK validates the JSON against the zod schema. */
export async function ask<S extends z.ZodType>(config: AssistantConfig, params: AskParams<S>): Promise<z.infer<S>> {
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

/** Short, safe description for server logs (no headers, no request bodies). */
export const describeAssistantError = (error: unknown) =>
  error instanceof AssistantError ? `${error.reason}: ${error.message}` : error instanceof Error ? error.name : "unknown";
