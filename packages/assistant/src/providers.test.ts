import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { createClaudeCli, type Spawn } from "./claude-code";
import { ask, AssistantError, providerOf, resolveAssistantProviders, type AssistantConfig, type ProviderDeps } from "./client";
import { createCliTool } from "./codex-cli";
import { suggestDod } from "./dod";
import { suggestStack } from "./stack";

const schema = z.object({ ok: z.boolean() });
const params = { model: "m", effort: "low" as const, system: "Sistema", prompt: "Pregunta", schema };
const dodRequest = { project: { platforms: ["web" as const], goal: "Tienda" }, requirement: { title: "Login" }, existing: [] };

type FetchCall = { url: string; init: RequestInit; body: any };
const fakeFetch = (reply: (call: FetchCall) => Response | Promise<Response>) => {
  const calls: FetchCall[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {}, body: JSON.parse(String(init?.body ?? "{}")) };
    calls.push(call);
    return reply(call);
  }) as unknown as typeof fetch;
  return { fn, calls };
};
const http = (fn: typeof fetch) => ({ apiKey: "key-test", baseUrl: "https://example.test", fetch: fn, timeoutMs: 5_000 });

describe("openai-api provider", () => {
  const answer = (content: unknown[], extra: Record<string, unknown> = {}) =>
    Response.json({ id: "resp_1", status: "completed", output: [{ type: "message", role: "assistant", content }], ...extra });
  const config = (fn: typeof fetch): AssistantConfig => ({ provider: "openai-api", http: http(fn), models: { default: "gpt-a", heavy: "gpt-b" } });

  test("sends a strict json_schema request to /responses and returns validated data", async () => {
    const f = fakeFetch(() => answer([{ type: "output_text", text: JSON.stringify({ criteria: ["Valida el email"] }) }]));
    expect(await suggestDod(config(f.fn), dodRequest)).toEqual(["Valida el email"]);
    const [call] = f.calls;
    expect(call!.url).toBe("https://example.test/responses");
    expect((call!.init.headers as Record<string, string>).Authorization).toBe("Bearer key-test");
    expect(call!.body.model).toBe("gpt-a");
    expect(call!.body.instructions).toContain("Definition of Done");
    expect(call!.body.input[0].content).toContain("Login");
    expect(call!.body.reasoning).toEqual({ effort: "medium" });
    expect(call!.body.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(call!.body.text.format.schema.additionalProperties).toBe(false);
    expect(call!.body.text.format.schema.$schema).toBeUndefined();
  });

  test("the stack uses the heavy model", async () => {
    const f = fakeFetch(() =>
      answer([{ type: "output_text", text: JSON.stringify({ stack: ["Next.js", "TypeScript"], databases: [], rationale: "Simple.", alternatives: [] }) }]),
    );
    const result = await suggestStack(config(f.fn), { platforms: ["web"], goal: "Blog" });
    expect(result.source).toBe("assistant");
    expect(f.calls[0]!.body.model).toBe("gpt-b");
  });

  test.each([
    ["an HTTP error", () => new Response("{}", { status: 500 }), "api"],
    ["a refusal", () => answer([{ type: "refusal", refusal: "No" }]), "refusal"],
    ["a truncated answer", () => answer([], { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }), "truncated"],
    ["text that is not JSON", () => answer([{ type: "output_text", text: "hola" }]), "invalid"],
    ["the wrong shape", () => answer([{ type: "output_text", text: '{"ok":"yes"}' }]), "invalid"],
  ])("%s becomes an AssistantError", async (_, reply, reason) => {
    const promise = ask(config(fakeFetch(reply).fn), params);
    await expect(promise).rejects.toBeInstanceOf(AssistantError);
    await expect(promise).rejects.toMatchObject({ reason });
  });
});

describe("gemini-api provider", () => {
  const answer = (text: string, finishReason = "STOP") => Response.json({ candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason }] });
  const config = (fn: typeof fetch): AssistantConfig => ({ provider: "gemini-api", http: http(fn), models: { default: "gem-a", heavy: "gem-b" } });

  test("calls generateContent with responseJsonSchema and returns validated data", async () => {
    const f = fakeFetch(() => answer(JSON.stringify({ criteria: ["Muestra un error claro"] })));
    expect(await suggestDod(config(f.fn), dodRequest)).toEqual(["Muestra un error claro"]);
    const [call] = f.calls;
    expect(call!.url).toBe("https://example.test/models/gem-a:generateContent");
    expect((call!.init.headers as Record<string, string>)["x-goog-api-key"]).toBe("key-test");
    expect(call!.url).not.toContain("key-test");
    expect(call!.body.systemInstruction.parts[0].text).toContain("Definition of Done");
    expect(call!.body.contents[0].parts[0].text).toContain("Login");
    expect(call!.body.generationConfig.responseMimeType).toBe("application/json");
    expect(call!.body.generationConfig.responseJsonSchema.properties).toHaveProperty("criteria");
    expect(call!.body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "MEDIUM" });
  });

  test("thought parts are skipped", async () => {
    const f = fakeFetch(() => Response.json({ candidates: [{ content: { parts: [{ text: "pensando", thought: true }, { text: '{"ok":true}' }] }, finishReason: "STOP" }] }));
    expect(await ask(config(f.fn), params)).toEqual({ ok: true });
  });

  test.each([
    ["an HTTP error", () => new Response("{}", { status: 429 }), "api"],
    ["a blocked prompt", () => Response.json({ promptFeedback: { blockReason: "SAFETY" } }), "refusal"],
    ["a safety stop", () => answer("", "SAFETY"), "refusal"],
    ["a truncated answer", () => answer('{"ok":', "MAX_TOKENS"), "truncated"],
    ["text that is not JSON", () => answer("hola"), "invalid"],
    ["the wrong shape", () => answer('{"ok":1}'), "invalid"],
  ])("%s becomes an AssistantError", async (_, reply, reason) => {
    await expect(ask(config(fakeFetch(reply).fn), params)).rejects.toMatchObject({ reason });
  });
});

type SpawnCall = Parameters<Spawn>;
const flagValue = (cmd: string[], flag: string) => cmd[cmd.indexOf(flag) + 1];

describe("codex-cli provider", () => {
  /** A fake `codex`: writes `answer` to the --output-last-message file, as codex exec does. */
  const fakeCodex = (answer: (call: SpawnCall) => string | null, code = 0) => {
    const calls: { cmd: string[]; opts: SpawnCall[1]; schema: any }[] = [];
    const spawn: Spawn = async (cmd, opts) => {
      const schema = JSON.parse(await readFile(flagValue(cmd, "--output-schema")!, "utf8"));
      calls.push({ cmd, opts, schema });
      const text = answer([cmd, opts]);
      if (text !== null) await writeFile(flagValue(cmd, "--output-last-message")!, text);
      return { code, stdout: "", stderr: "" };
    };
    return { cli: createCliTool("codex", { spawn }), calls };
  };
  const config = (cli: ReturnType<typeof fakeCodex>["cli"], model = "gpt-a"): AssistantConfig => ({
    provider: "codex-cli",
    cli,
    models: { default: model, heavy: model },
    env: { HOME: "/home/x" },
  });

  test("runs codex exec read-only with the schema file and returns validated data", async () => {
    const fake = fakeCodex(() => JSON.stringify({ criteria: ["Guarda la sesión"] }));
    expect(await suggestDod(config(fake.cli), dodRequest)).toEqual(["Guarda la sesión"]);
    const { cmd, opts, schema } = fake.calls[0]!;
    expect(cmd.slice(0, 3)).toEqual(["codex", "exec", "-"]);
    expect(flagValue(cmd, "--sandbox")).toBe("read-only");
    expect(cmd).toContain("--ephemeral");
    expect(cmd).toContain("--skip-git-repo-check");
    expect(cmd).toContain("--ignore-user-config");
    expect(flagValue(cmd, "--model")).toBe("gpt-a");
    expect(cmd).toContain('model_reasoning_effort="medium"');
    expect(cmd.find((a) => a.startsWith("developer_instructions="))).toContain("Definition of Done");
    expect(schema.properties).toHaveProperty("criteria");
    expect(opts.stdin).toContain("Login");
    expect(opts.env.HOME).toBe("/home/x");
  });

  test("without a model it leaves the choice to the CLI's configuration", async () => {
    const fake = fakeCodex(() => '{"ok":true}');
    await ask(config(fake.cli, ""), { ...params, model: "" });
    expect(fake.calls[0]!.cmd).not.toContain("--model");
  });

  test("errors and invalid answers become AssistantError", async () => {
    await expect(ask(config(fakeCodex(() => null, 1).cli), params)).rejects.toMatchObject({ reason: "api" });
    await expect(ask(config(fakeCodex(() => "no json").cli), params)).rejects.toMatchObject({ reason: "invalid" });
    await expect(ask(config(fakeCodex(() => '{"ok":"yes"}').cli), params)).rejects.toThrow("formato inválido");
    const missing = createCliTool("codex", { spawn: async () => { throw new Error("ENOENT"); } });
    await expect(ask(config(missing), params)).rejects.toMatchObject({ reason: "api" });
  });
});

describe("gemini-cli provider", () => {
  const fakeGemini = (stdout: (call: SpawnCall) => unknown, code = 0) => {
    const calls: { cmd: string[]; opts: SpawnCall[1]; system: string }[] = [];
    const spawn: Spawn = async (cmd, opts) => {
      calls.push({ cmd, opts, system: await readFile(opts.env.GEMINI_SYSTEM_MD!, "utf8") });
      const out = stdout([cmd, opts]);
      return { code, stdout: typeof out === "string" ? out : JSON.stringify(out), stderr: "" };
    };
    return { cli: createCliTool("gemini", { spawn }), calls };
  };
  const config = (cli: ReturnType<typeof fakeGemini>["cli"]): AssistantConfig => ({ provider: "gemini-cli", cli, models: { default: "gem-a", heavy: "gem-a" }, env: {} });

  test("runs gemini headless with JSON output, the system prompt file and the schema in the prompt", async () => {
    const fake = fakeGemini(() => ({ response: JSON.stringify({ criteria: ["Cierra la sesión"] }), stats: {} }));
    expect(await suggestDod(config(fake.cli), dodRequest)).toEqual(["Cierra la sesión"]);
    const { cmd, opts, system } = fake.calls[0]!;
    expect(cmd.slice(0, 2)).toEqual(["gemini", "-p"]);
    expect(flagValue(cmd, "--output-format")).toBe("json");
    expect(flagValue(cmd, "--approval-mode")).toBe("plan");
    expect(flagValue(cmd, "--model")).toBe("gem-a");
    expect(system).toContain("Definition of Done");
    expect(opts.stdin).toContain("Login");
    expect(opts.stdin).toContain('"criteria"');
  });

  test("an answer wrapped in a code fence is accepted", async () => {
    const fake = fakeGemini(() => ({ response: '```json\n{"ok":true}\n```' }));
    expect(await ask(config(fake.cli), params)).toEqual({ ok: true });
  });

  test("errors and invalid answers become AssistantError", async () => {
    await expect(ask(config(fakeGemini(() => ({ error: { message: "auth" } }), 1).cli), params)).rejects.toMatchObject({ reason: "api" });
    await expect(ask(config(fakeGemini(() => "not json").cli), params)).rejects.toMatchObject({ reason: "api" });
    await expect(ask(config(fakeGemini(() => ({ response: "hola" })).cli), params)).rejects.toMatchObject({ reason: "invalid" });
    await expect(ask(config(fakeGemini(() => ({ response: '{"ok":0}' })).cli), params)).rejects.toThrow("formato inválido");
  });
});

describe("resolveAssistantProviders", () => {
  const cli = (available: boolean) =>
    createCliTool("x", {
      spawn: async (cmd) => {
        if (!available) throw new Error("ENOENT");
        return { code: 0, stdout: cmd.includes("auth") ? JSON.stringify({ loggedIn: true }) : "1.0.0", stderr: "" };
      },
    });
  const deps = (on: { claude?: boolean; codex?: boolean; gemini?: boolean }): ProviderDeps => ({
    claude: createClaudeCli({ spawn: cli(on.claude ?? false).spawn }),
    codex: cli(on.codex ?? false),
    geminiCli: cli(on.gemini ?? false),
  });
  const ids = (configs: AssistantConfig[]) => configs.map(providerOf);

  test("lists every available provider in auto order and picks the first, Claude first", async () => {
    const env = { OPENAI_API_KEY: "sk-o", GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "sk-a" };
    const { available, active } = await resolveAssistantProviders(env, deps({ claude: true, codex: true, gemini: true }));
    expect(ids(available)).toEqual(["api", "claude-code", "openai-api", "gemini-api", "codex-cli", "gemini-cli"]);
    expect(providerOf(active!)).toBe("api");
  });

  test("without Claude, an OpenAI key is used, then a Gemini key, then the CLIs", async () => {
    expect(providerOf((await resolveAssistantProviders({ OPENAI_API_KEY: "sk-o", GEMINI_API_KEY: "g" }, deps({}))).active!)).toBe("openai-api");
    expect(providerOf((await resolveAssistantProviders({ GEMINI_API_KEY: "g" }, deps({ codex: true }))).active!)).toBe("gemini-api");
    expect(providerOf((await resolveAssistantProviders({}, deps({ codex: true, gemini: true }))).active!)).toBe("codex-cli");
    expect(providerOf((await resolveAssistantProviders({}, deps({ gemini: true }))).active!)).toBe("gemini-cli");
    expect((await resolveAssistantProviders({}, deps({}))).active).toBeNull();
  });

  test("AGENT_TRACKING_ASSISTANT_PROVIDER picks one, only if it is available", async () => {
    const env = { ANTHROPIC_API_KEY: "sk-a", GEMINI_API_KEY: "g" };
    const pick = async (provider: string) => (await resolveAssistantProviders({ ...env, AGENT_TRACKING_ASSISTANT_PROVIDER: provider }, deps({ codex: true }))).active;
    expect(providerOf((await pick("gemini-api"))!)).toBe("gemini-api");
    expect(providerOf((await pick("codex-cli"))!)).toBe("codex-cli");
    expect(await pick("openai-api")).toBeNull();
    expect(await pick("off")).toBeNull();
  });

  test("models come from env vars with verified defaults", async () => {
    const env = { OPENAI_API_KEY: "o", GEMINI_API_KEY: "g", AGENT_TRACKING_GEMINI_MODEL: "gemini-x", AGENT_TRACKING_CODEX_HEAVY_MODEL: "gpt-z" };
    const { available } = await resolveAssistantProviders(env, deps({ codex: true }));
    const models = Object.fromEntries(available.map((c) => [providerOf(c), c.models]));
    expect(models["openai-api"]).toEqual({ default: "gpt-6.2-sol", heavy: "gpt-6.2-astra" });
    expect(models["gemini-api"]).toEqual({ default: "gemini-x", heavy: "gemini-4-carbon" });
    expect(models["codex-cli"]).toEqual({ default: "", heavy: "gpt-z" });
  });
});
