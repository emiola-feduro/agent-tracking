import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { claudeCliAvailable, ClaudeCliError, createClaudeCli, runClaudeCli, type ClaudeCli } from "./claude-code";
import { codexCliAvailable, createCodexCli, runCodexCli, type CliTool } from "./codex-cli";
import { AssistantError } from "./errors";
import { GEMINI_DEFAULT_MODEL, GEMINI_HEAVY_MODEL, runGemini } from "./gemini";
import { createGeminiCli, geminiCliAvailable, runGeminiCli } from "./gemini-cli";
import { OPENAI_DEFAULT_MODEL, OPENAI_HEAVY_MODEL, runOpenAI, type HttpClient, type JsonRequest } from "./openai";

export { AssistantError } from "./errors";

/** Everyday model for short, structured answers. */
export const DEFAULT_MODEL = "claude-sonnet-5-5";
/** Used where the answer weighs trade-offs (stack recommendation). */
export const HEAVY_MODEL = "claude-opus-5-5";

export type Effort = "low" | "medium" | "high";

/** The part of the Anthropic client the assistant uses; tests pass a client with a fake `fetch`. */
export type AssistantClient = Pick<Anthropic, "beta">;

/** What the assistant is asked for; each one can use its own model. */
export const ASSISTANT_TASKS = ["stack", "dod", "skills"] as const;
export type AssistantTask = (typeof ASSISTANT_TASKS)[number];

export const ASSISTANT_TASK_INFO: Record<AssistantTask, { label: string; description: string; tier: "default" | "heavy" }> = {
  stack: { label: "Stack", description: "Recomienda lenguajes, frameworks y bases de datos", tier: "heavy" },
  dod: { label: "Criterios del DoD", description: "Propone criterios de aceptación para un requerimiento", tier: "default" },
  skills: { label: "Skills", description: "Elige las skills que sirven al proyecto", tier: "default" },
};

/**
 * `default` for short, structured answers and `heavy` where the answer weighs trade-offs; `tasks`
 * are the person's own choices per task, which win over both. Empty means the provider's default.
 */
export type Models = { default: string; heavy: string; tasks?: Partial<Record<AssistantTask, string>> };

/** The model a task runs with: the one chosen for it, else its tier's. Empty on a CLI means the CLI's default. */
export const modelFor = (config: { models: Models }, task: AssistantTask): string =>
  config.models.tasks?.[task]?.trim() || config.models[ASSISTANT_TASK_INFO[task].tier];
type Env = Record<string, string | undefined>;

/**
 * Where requests go: the Claude API with a key, the local Claude Code CLI with the person's own
 * login (covered by a Pro or Max subscription), the OpenAI or Gemini APIs with a key, or the local
 * Codex CLI or Gemini CLI with their own logins. An empty model on a CLI means "the CLI's default".
 */
export type AssistantConfig =
  | { provider?: "api"; client: AssistantClient; models: Models }
  | { provider: "claude-code"; cli: ClaudeCli; models: Models; env?: Env }
  | { provider: "openai-api"; http: HttpClient; models: Models }
  | { provider: "gemini-api"; http: HttpClient; models: Models }
  | { provider: "codex-cli"; cli: CliTool; models: Models; env?: Env }
  | { provider: "gemini-cli"; cli: CliTool; models: Models; env?: Env };

/** In the order auto mode tries them: Claude first, as before other providers existed. */
export const ASSISTANT_PROVIDERS = ["api", "claude-code", "openai-api", "gemini-api", "codex-cli", "gemini-cli"] as const;
export type AssistantProvider = (typeof ASSISTANT_PROVIDERS)[number];
export const providerOf = (config: AssistantConfig): AssistantProvider => config.provider ?? "api";

/**
 * Model names offered in the UI for each provider (any other name can be typed). The CLIs take the
 * same names as their vendor's API.
 */
const CLAUDE_MODELS = ["claude-fable-5-2", "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
export const SUGGESTED_MODELS: Record<AssistantProvider, string[]> = {
  api: CLAUDE_MODELS,
  "claude-code": CLAUDE_MODELS,
  "openai-api": [OPENAI_HEAVY_MODEL, OPENAI_DEFAULT_MODEL],
  "gemini-api": [GEMINI_HEAVY_MODEL, GEMINI_DEFAULT_MODEL],
  "codex-cli": [OPENAI_HEAVY_MODEL, OPENAI_DEFAULT_MODEL],
  "gemini-cli": [GEMINI_HEAVY_MODEL, GEMINI_DEFAULT_MODEL],
};

/** How the UI and the logs name each provider; `vendor` is whose tokens a request spends. */
export const PROVIDER_INFO: Record<AssistantProvider, { label: string; vendor: string }> = {
  api: { label: "Claude (API key)", vendor: "Claude" },
  "claude-code": { label: "Claude Code", vendor: "Claude" },
  "openai-api": { label: "OpenAI (API key)", vendor: "OpenAI" },
  "gemini-api": { label: "Gemini (API key)", vendor: "Gemini" },
  "codex-cli": { label: "Codex CLI", vendor: "Codex" },
  "gemini-cli": { label: "Gemini CLI", vendor: "Gemini" },
};

const modelsFromEnv = (env: Env): Models => ({
  default: env.AGENT_TRACKING_ASSISTANT_MODEL || DEFAULT_MODEL,
  heavy: env.AGENT_TRACKING_ASSISTANT_HEAVY_MODEL || HEAVY_MODEL,
});

/** Per provider model variables, e.g. AGENT_TRACKING_OPENAI_MODEL and AGENT_TRACKING_OPENAI_HEAVY_MODEL. */
const modelsFor = (env: Env, prefix: string, defaults: Models): Models => ({
  default: env[`AGENT_TRACKING_${prefix}_MODEL`] || defaults.default,
  heavy: env[`AGENT_TRACKING_${prefix}_HEAVY_MODEL`] || defaults.heavy,
});

/**
 * Builds the API assistant from the environment. Returns null without ANTHROPIC_API_KEY, which
 * keeps every endpoint on its deterministic behaviour. The key stays inside the SDK client.
 */
export function assistantConfigFromEnv(env: Env = process.env): AssistantConfig | null {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  return { provider: "api", client: new Anthropic({ apiKey, timeout: 90_000, maxRetries: 2 }), models: modelsFromEnv(env) };
}

const httpClient = (apiKey: string, baseUrl: string, fetchFn: typeof fetch): HttpClient => ({ apiKey, baseUrl, fetch: fetchFn, timeoutMs: 120_000 });

/** OpenAI Responses API with OPENAI_API_KEY, or null without it. */
export function openaiConfigFromEnv(env: Env = process.env, fetchFn: typeof fetch = fetch): AssistantConfig | null {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const models = modelsFor(env, "OPENAI", { default: OPENAI_DEFAULT_MODEL, heavy: OPENAI_HEAVY_MODEL });
  return { provider: "openai-api", http: httpClient(apiKey, "https://api.openai.com/v1", fetchFn), models };
}

/** Gemini API with GEMINI_API_KEY, or null without it. */
export function geminiConfigFromEnv(env: Env = process.env, fetchFn: typeof fetch = fetch): AssistantConfig | null {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  const models = modelsFor(env, "GEMINI", { default: GEMINI_DEFAULT_MODEL, heavy: GEMINI_HEAVY_MODEL });
  return { provider: "gemini-api", http: httpClient(apiKey, "https://generativelanguage.googleapis.com/v1beta", fetchFn), models };
}

/** Local CLIs and `fetch`, injectable so tests never start a process or touch the network. */
export type ProviderDeps = { claude?: ClaudeCli; codex?: CliTool; geminiCli?: CliTool; fetch?: typeof fetch };

/** Every provider this machine can use right now, in auto order. CLIs are checked in parallel. */
export async function detectAssistantProviders(env: Env = process.env, deps: ProviderDeps = {}): Promise<AssistantConfig[]> {
  const claude = deps.claude ?? createClaudeCli({ bin: env.AGENT_TRACKING_CLAUDE_BIN || undefined });
  const codex = deps.codex ?? createCodexCli({ bin: env.AGENT_TRACKING_CODEX_BIN || undefined });
  const geminiCli = deps.geminiCli ?? createGeminiCli({ bin: env.AGENT_TRACKING_GEMINI_BIN || undefined });
  const [hasClaude, hasCodex, hasGemini] = await Promise.all([
    claudeCliAvailable(claude, env),
    codexCliAvailable(codex, env),
    geminiCliAvailable(geminiCli, env),
  ]);
  // CLI defaults are empty: each CLI then uses the model its own configuration picks.
  const cliModels = (prefix: string) => modelsFor(env, prefix, { default: "", heavy: "" });
  const found: (AssistantConfig | null)[] = [
    assistantConfigFromEnv(env),
    hasClaude ? { provider: "claude-code", cli: claude, models: modelsFromEnv(env), env } : null,
    openaiConfigFromEnv(env, deps.fetch),
    geminiConfigFromEnv(env, deps.fetch),
    hasCodex ? { provider: "codex-cli", cli: codex, models: cliModels("CODEX"), env } : null,
    hasGemini ? { provider: "gemini-cli", cli: geminiCli, models: cliModels("GEMINI_CLI"), env } : null,
  ];
  return found.filter((c): c is AssistantConfig => c !== null);
}

/**
 * Detects the providers at startup and picks the active one. `AGENT_TRACKING_ASSISTANT_PROVIDER`
 * can name one provider (it is used only if available), `off`, or `auto` (default): the first
 * available one, Claude first (an API key, then a logged-in Claude Code), then OpenAI, Gemini,
 * Codex CLI and Gemini CLI. The other available providers can be chosen later at runtime.
 */
export async function resolveAssistantProviders(
  env: Env = process.env,
  deps: ProviderDeps = {},
): Promise<{ available: AssistantConfig[]; active: AssistantConfig | null }> {
  const wanted = (env.AGENT_TRACKING_ASSISTANT_PROVIDER ?? "auto").trim().toLowerCase();
  if (wanted === "off") return { available: [], active: null };
  const available = await detectAssistantProviders(env, deps);
  const named = (ASSISTANT_PROVIDERS as readonly string[]).includes(wanted);
  const active = named ? (available.find((c) => providerOf(c) === wanted) ?? null) : (available[0] ?? null);
  return { available, active };
}

/** The active provider only (see resolveAssistantProviders). */
export async function resolveAssistantConfig(env: Env = process.env, deps: ProviderDeps = {}): Promise<AssistantConfig | null> {
  return (await resolveAssistantProviders(env, deps)).active;
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
  if (!("client" in config)) return askOther(config, params);
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

const jsonRequest = (params: AskParams<z.ZodType>): JsonRequest => ({
  model: params.model,
  effort: params.effort,
  system: params.system,
  prompt: params.prompt,
  jsonSchema: z.toJSONSchema(params.schema, { target: "draft-7" }) as Record<string, unknown>,
});

/** OpenAI, Gemini and the Codex and Gemini CLIs: each returns raw JSON, validated here. */
async function askOther<S extends z.ZodType>(
  config: Extract<AssistantConfig, { provider: "openai-api" | "gemini-api" | "codex-cli" | "gemini-cli" }>,
  params: AskParams<S>,
): Promise<z.infer<S>> {
  const req = jsonRequest(params);
  const output =
    config.provider === "openai-api"
      ? await runOpenAI(config.http, req)
      : config.provider === "gemini-api"
        ? await runGemini(config.http, req)
        : config.provider === "codex-cli"
          ? await runCodexCli(config.cli, req, config.env)
          : await runGeminiCli(config.cli, req, config.env);
  const parsed = params.schema.safeParse(output);
  if (!parsed.success) throw new AssistantError("Respuesta con formato inválido", "invalid");
  return parsed.data;
}

/** Short, safe description for server logs (no headers, no request bodies). */
export const describeAssistantError = (error: unknown) =>
  error instanceof AssistantError ? `${error.reason}: ${error.message}` : error instanceof Error ? error.name : "unknown";
