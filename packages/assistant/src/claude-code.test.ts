import { describe, expect, test } from "bun:test";
import { createClaudeCli, type Spawn } from "./claude-code";
import { ask, AssistantError, resolveAssistantConfig, type AssistantConfig } from "./client";
import { suggestDod } from "./dod";
import { z } from "zod";

type Call = Parameters<Spawn>;

/** A fake `claude` binary: `auth status` and `-p` answers are scripted per test. */
const fakeCli = (opts: { loggedIn?: boolean; installed?: boolean; answer?: (call: Call) => unknown }) => {
  const calls: Call[] = [];
  const spawn: Spawn = async (cmd, o) => {
    calls.push([cmd, o]);
    if (opts.installed === false) throw new Error("ENOENT");
    if (cmd[1] === "auth") return { code: 0, stdout: JSON.stringify({ loggedIn: opts.loggedIn ?? true, authMethod: "claude.ai" }), stderr: "" };
    const out = opts.answer?.([cmd, o]);
    return { code: 0, stdout: typeof out === "string" ? out : JSON.stringify(out), stderr: "" };
  };
  return { cli: createClaudeCli({ spawn }), calls };
};

const success = (structured: unknown) => ({ type: "result", subtype: "success", is_error: false, structured_output: structured });

describe("resolveAssistantConfig", () => {
  test("an API key wins in auto mode", async () => {
    const { cli } = fakeCli({});
    const config = await resolveAssistantConfig({ ANTHROPIC_API_KEY: "sk-test" }, cli);
    expect(config?.provider).toBe("api");
  });

  test("without a key, a logged-in Claude Code is used", async () => {
    const { cli } = fakeCli({ loggedIn: true });
    expect((await resolveAssistantConfig({}, cli))?.provider).toBe("claude-code");
  });

  test("not logged in or not installed means no assistant", async () => {
    expect(await resolveAssistantConfig({}, fakeCli({ loggedIn: false }).cli)).toBeNull();
    expect(await resolveAssistantConfig({}, fakeCli({ installed: false }).cli)).toBeNull();
  });

  test("the provider can be forced or turned off", async () => {
    const { cli } = fakeCli({ loggedIn: true });
    expect(await resolveAssistantConfig({ AGENT_TRACKING_ASSISTANT_PROVIDER: "off", ANTHROPIC_API_KEY: "sk" }, cli)).toBeNull();
    expect(await resolveAssistantConfig({ AGENT_TRACKING_ASSISTANT_PROVIDER: "api" }, cli)).toBeNull();
    const forced = await resolveAssistantConfig({ AGENT_TRACKING_ASSISTANT_PROVIDER: "claude-code", ANTHROPIC_API_KEY: "sk" }, cli);
    expect(forced?.provider).toBe("claude-code");
  });
});

describe("claude-code provider", () => {
  const config = (cli: ReturnType<typeof fakeCli>["cli"], env: Record<string, string | undefined> = {}): AssistantConfig => ({
    provider: "claude-code",
    cli,
    models: { default: "claude-sonnet-5-5", heavy: "claude-opus-5-5" },
    env,
  });

  test("runs claude -p without tools, with the schema, and returns validated data", async () => {
    const { cli, calls } = fakeCli({ answer: () => success({ criteria: ["El login valida el email", "Muestra error claro"] }) });
    const criteria = await suggestDod(config(cli), {
      project: { platforms: ["web"], goal: "Tienda" },
      requirement: { title: "Login" },
      existing: [],
    });
    expect(criteria).toEqual(["El login valida el email", "Muestra error claro"]);
    const [cmd, opts] = calls.at(-1)!;
    expect(cmd.slice(0, 2)).toEqual(["claude", "-p"]);
    expect(cmd[cmd.indexOf("--tools") + 1]).toBe("");
    expect(cmd).toContain("--strict-mcp-config");
    expect(cmd[cmd.indexOf("--model") + 1]).toBe("claude-sonnet-5-5");
    expect(JSON.parse(cmd[cmd.indexOf("--json-schema") + 1]!).properties).toHaveProperty("criteria");
    expect(opts.stdin).toContain("Login");
  });

  test("a parent Claude Code session and an API key are not passed to the child", async () => {
    const { cli, calls } = fakeCli({ answer: () => success({ ok: true }) });
    await ask(config(cli, { CLAUDECODE: "1", ANTHROPIC_API_KEY: "sk-x", HOME: "/home/x" }), {
      model: "m",
      effort: "low",
      system: "s",
      prompt: "p",
      schema: z.object({ ok: z.boolean() }),
    });
    const env = calls.at(-1)![1].env;
    expect(env.CLAUDECODE).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.HOME).toBe("/home/x");
  });

  test("errors and invalid answers become AssistantError", async () => {
    const schema = z.object({ ok: z.boolean() });
    const params = { model: "m", effort: "low" as const, system: "s", prompt: "p", schema };
    const failing = fakeCli({ answer: () => ({ type: "result", subtype: "error_during_execution", is_error: true }) });
    expect(ask(config(failing.cli), params)).rejects.toBeInstanceOf(AssistantError);
    const garbage = fakeCli({ answer: () => "not json" });
    expect(ask(config(garbage.cli), params)).rejects.toBeInstanceOf(AssistantError);
    const wrongShape = fakeCli({ answer: () => success({ ok: "yes" }) });
    expect(ask(config(wrongShape.cli), params)).rejects.toThrow("formato inválido");
  });

  test("requests run one at a time", async () => {
    let running = 0;
    let maxRunning = 0;
    const spawn: Spawn = async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await Bun.sleep(20);
      running--;
      return { code: 0, stdout: JSON.stringify(success({ ok: true })), stderr: "" };
    };
    const cli = createClaudeCli({ spawn });
    const params = { model: "m", effort: "low" as const, system: "s", prompt: "p", schema: z.object({ ok: z.boolean() }) };
    await Promise.all([ask(config(cli), params), ask(config(cli), params), ask(config(cli), params)]);
    expect(maxRunning).toBe(1);
  });
});
