import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentStatus, applyChanges, connectPlan, disconnectPlan } from "./connect";

let home: string;
const opts = () => ({ home, serverUrl: "http://127.0.0.1:4317" });
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "at-home-"));
});
afterEach(() => rm(home, { recursive: true, force: true }));

describe("connecting agents", () => {
  test("Gemini: MCP and hooks merged into existing settings, idempotent, reversible", async () => {
    await mkdir(join(home, ".gemini"));
    const original = JSON.stringify({ theme: "Dracula", hooks: { BeforeTool: [{ matcher: "write_file", hooks: [{ type: "command", command: "mine.sh" }] }] } }, null, 2) + "\n";
    await writeFile(join(home, ".gemini/settings.json"), original);

    const plan = await connectPlan("gemini-cli", opts());
    expect(plan).toHaveLength(1);
    await applyChanges(plan);
    const settings = JSON.parse(await readFile(join(home, ".gemini/settings.json"), "utf8"));
    expect(settings.theme).toBe("Dracula");
    expect(settings.mcpServers["agent-tracking"]).toEqual({ httpUrl: "http://127.0.0.1:4317/mcp?agent=gemini-cli" });
    expect(settings.hooks.BeforeTool).toHaveLength(2);
    expect(settings.hooks.AfterAgent[0].hooks[0].command).toContain("/api/agent/hook?agent=gemini-cli");
    expect(await readFile(join(home, ".gemini/settings.json.bak"), "utf8")).toBe(original);
    expect(await agentStatus("gemini-cli", { home })).toMatchObject({ installed: true, mcp: true, mcpOutdated: false, hooks: true });
    expect(await connectPlan("gemini-cli", opts())).toEqual([]);

    await applyChanges(await disconnectPlan("gemini-cli", { home }));
    expect(JSON.parse(await readFile(join(home, ".gemini/settings.json"), "utf8"))).toEqual(JSON.parse(original));
  });

  test("Codex: TOML block appended and removed; hooks.json created", async () => {
    await mkdir(join(home, ".codex"));
    await writeFile(join(home, ".codex/config.toml"), 'model = "gpt"\n\n[mcp_servers.otro]\ncommand = "x"\n');
    process.env.CODEX_HOME = join(home, ".codex");
    try {
      await applyChanges(await connectPlan("codex", opts()));
      const toml = await readFile(join(home, ".codex/config.toml"), "utf8");
      expect(toml).toContain('[mcp_servers.agent-tracking]\nurl = "http://127.0.0.1:4317/mcp?agent=codex"');
      expect(toml).toContain("[mcp_servers.otro]");
      const hooks = JSON.parse(await readFile(join(home, ".codex/hooks.json"), "utf8"));
      expect(Object.keys(hooks.hooks).sort()).toEqual(["PreToolUse", "Stop", "UserPromptSubmit"]);
      expect(await agentStatus("codex", { home })).toMatchObject({ mcp: true, hooks: true });

      await applyChanges(await disconnectPlan("codex", { home }));
      const after = await readFile(join(home, ".codex/config.toml"), "utf8");
      expect(after).not.toContain("agent-tracking");
      expect(after).toContain('model = "gpt"');
      expect(after).toContain("[mcp_servers.otro]");
    } finally {
      delete process.env.CODEX_HOME;
    }
  });

  test("Claude Code: hooks in settings.json, MCP through its CLI; a stale plan is refused", async () => {
    await mkdir(join(home, ".claude"));
    const plan = await connectPlan("claude-code", opts());
    expect(plan.map((c) => c.type)).toEqual(["file", "command"]);
    const ran: string[][] = [];
    await applyChanges(plan, async (argv) => (ran.push(argv), { ok: true, stderr: "" }));
    expect(ran[0]).toEqual(["claude", "mcp", "add", "--transport", "http", "--scope", "user", "agent-tracking", "http://127.0.0.1:4317/mcp?agent=claude-code"]);

    const stale = await connectPlan("gemini-cli", opts());
    await mkdir(join(home, ".gemini"), { recursive: true });
    await writeFile(join(home, ".gemini/settings.json"), "{}");
    await expect(applyChanges(stale)).rejects.toThrow("cambió");
  });

  test("an MCP registered as a local process is outdated and connecting again moves it to HTTP", async () => {
    // Claude Code: user scope and a project's own (local scope) registration.
    await mkdir(join(home, ".claude"));
    const local = { command: "bun", args: ["/at/packages/mcp/src/stdio.ts", "--agent", "claude-code"] };
    await writeFile(join(home, ".claude.json"), JSON.stringify({ mcpServers: { "agent-tracking": local }, projects: { "/w/tienda": { mcpServers: { "agent-tracking": local } } } }));
    expect(await agentStatus("claude-code", { home })).toMatchObject({ mcp: true, mcpOutdated: true });
    const ran: { argv: string[]; cwd?: string }[] = [];
    await applyChanges(
      (await connectPlan("claude-code", opts())).filter((c) => c.type === "command"),
      async (argv, cwd) => (ran.push({ argv, cwd }), { ok: true, stderr: "" }),
    );
    expect(ran).toEqual([
      { argv: ["claude", "mcp", "remove", "--scope", "local", "agent-tracking"], cwd: "/w/tienda" },
      { argv: ["claude", "mcp", "remove", "--scope", "user", "agent-tracking"], cwd: undefined },
      { argv: ["claude", "mcp", "add", "--transport", "http", "--scope", "user", "agent-tracking", "http://127.0.0.1:4317/mcp?agent=claude-code"], cwd: undefined },
    ]);

    // Codex: the old table is replaced, the rest of the file stays.
    await mkdir(join(home, ".codex"));
    process.env.CODEX_HOME = join(home, ".codex");
    try {
      await writeFile(
        join(home, ".codex/config.toml"),
        'model = "gpt"\n\n# Agent Tracking (agregado desde Agent Tracking; bórralo para desconectar)\n[mcp_servers.agent-tracking]\ncommand = "bun"\nargs = ["x"]\n\n[mcp_servers.otro]\ncommand = "y"\n',
      );
      expect(await agentStatus("codex", { home })).toMatchObject({ mcpOutdated: true });
      await applyChanges((await connectPlan("codex", opts())).filter((c) => c.type === "file" && c.path.endsWith("config.toml")));
      const toml = await readFile(join(home, ".codex/config.toml"), "utf8");
      expect(toml).not.toContain('command = "bun"');
      expect(toml.match(/\[mcp_servers\.agent-tracking\]/g)).toHaveLength(1);
      expect(toml).toContain('url = "http://127.0.0.1:4317/mcp?agent=codex"');
      expect(toml).toContain('[mcp_servers.otro]\ncommand = "y"');
      expect(await agentStatus("codex", { home })).toMatchObject({ mcp: true, mcpOutdated: false });
    } finally {
      delete process.env.CODEX_HOME;
    }
  });
});
