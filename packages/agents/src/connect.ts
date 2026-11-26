import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { AgentKind } from "./types";

/**
 * Connecting an agent to Agent Tracking: its MCP server and its hooks, written into the agent's own
 * configuration. Every change is computed first (before and after of each file, or the command to
 * run) so the person sees exactly what will be touched; applying keeps a .bak of each file.
 * Everything Agent Tracking adds is recognizable (the "agent-tracking" MCP name, hook commands that
 * call /api/agent/hook), so disconnecting removes only that.
 */
export type FileChange =
  | { type: "file"; path: string; description: string; before: string | null; after: string }
  | { type: "command"; argv: string[]; description: string };

export type ConnectOptions = {
  /** Agent Tracking server, e.g. http://127.0.0.1:4317 */
  serverUrl: string;
  /** Command that starts the stdio MCP bridge, e.g. ["bun", "/…/packages/mcp/src/stdio.ts"] */
  mcpCommand: string[];
  /** Home folder; tests point it elsewhere (AGENT_TRACKING_HOME). */
  home?: string;
};

export type AgentStatus = {
  kind: AgentKind;
  installed: boolean;
  mcp: boolean;
  /** Our hooks are there, in their current form. */
  hooks: boolean;
  /** Our hooks are there but written by an older Agent Tracking: connecting again updates them. */
  hooksOutdated: boolean;
  configPath: string;
};

export const MCP_NAME = "agent-tracking";
const HOOK_MARK = "/api/agent/hook";

export const homeDir = (opts?: { home?: string }) => opts?.home ?? process.env.AGENT_TRACKING_HOME ?? homedir();

/**
 * Version of the hook command. Version 2 passes the server's answer on to the agent (a denied git
 * command, a reminder to report) and waits up to 10 s; version 1 dropped the answer after 1 s.
 */
const HOOK_VERSION = "v=2";

/** The hook posts the event to Agent Tracking and prints its answer (empty when there is nothing to say). */
const hookCommand = (serverUrl: string, kind: AgentKind) =>
  `curl -sf -m 10 -X POST -H content-type:application/json --data-binary @- "${serverUrl.replace(/\/$/, "")}${HOOK_MARK}?agent=${kind}&${HOOK_VERSION}" || true`;

const readText = async (path: string) => readFile(path, "utf8").catch(() => null);
const readJson = (text: string | null): Record<string, any> => {
  if (!text?.trim()) return {};
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    throw new Error("El archivo de configuración no es JSON válido: corrígelo antes de conectar");
  }
};
const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

type HookGroup = { matcher?: string; hooks: { type: string; command: string; timeout?: number; name?: string }[] };
const isOurs = (h: { command?: string }) => typeof h.command === "string" && h.command.includes(HOOK_MARK);
const isCurrent = (h: { command?: string }) => isOurs(h) && h.command!.includes(HOOK_VERSION);

/** Adds our hook to each event, once, replacing an older version of it; the rest stays as it was. */
function withHooks(config: Record<string, any>, events: string[], hook: HookGroup["hooks"][number], matcher?: string) {
  const hooks = { ...(config.hooks ?? {}) } as Record<string, HookGroup[]>;
  for (const event of events) {
    const groups = (hooks[event] ?? []).map((g) => ({ ...g, hooks: (g.hooks ?? []).map((h) => (isOurs(h) && !isCurrent(h) ? hook : h)) }));
    hooks[event] = groups;
    if (groups.some((g) => g.hooks.some(isOurs))) continue;
    groups.push({ ...(matcher !== undefined ? { matcher } : {}), hooks: [hook] });
    hooks[event] = groups;
  }
  return { ...config, hooks };
}

/** Removes only our hooks (and groups left empty). */
function withoutHooks(config: Record<string, any>) {
  if (!config.hooks) return config;
  const hooks: Record<string, HookGroup[]> = {};
  for (const [event, groups] of Object.entries(config.hooks as Record<string, HookGroup[]>)) {
    const kept = groups.map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !isOurs(h)) })).filter((g) => g.hooks.length > 0);
    if (kept.length) hooks[event] = kept;
  }
  const { hooks: _old, ...rest } = config;
  return Object.keys(hooks).length ? { ...rest, hooks } : rest;
}

const hasHooks = (config: Record<string, any>, events: string[], test = isCurrent) =>
  events.every((e) => ((config.hooks?.[e] ?? []) as HookGroup[]).some((g) => g.hooks?.some(test)));

/* ---------- Per agent ---------- */

const CLAUDE_EVENTS = ["UserPromptSubmit", "PreToolUse", "Stop"];
const CODEX_EVENTS = ["UserPromptSubmit", "PreToolUse", "Stop"];
const GEMINI_EVENTS = ["BeforeAgent", "BeforeTool", "AfterAgent", "SessionEnd"];

const paths = (kind: AgentKind, home: string) =>
  ({
    "claude-code": { dir: join(home, ".claude"), hooks: join(home, ".claude", "settings.json"), mcp: join(home, ".claude.json") },
    codex: { dir: join(process.env.CODEX_HOME ?? join(home, ".codex")), hooks: join(process.env.CODEX_HOME ?? join(home, ".codex"), "hooks.json"), mcp: join(process.env.CODEX_HOME ?? join(home, ".codex"), "config.toml") },
    "gemini-cli": { dir: join(home, ".gemini"), hooks: join(home, ".gemini", "settings.json"), mcp: join(home, ".gemini", "settings.json") },
  })[kind];

const BINARIES: Record<AgentKind, string> = { "claude-code": "claude", codex: "codex", "gemini-cli": "gemini" };

const tomlHasMcp = (toml: string | null) => !!toml && new RegExp(`^\\[mcp_servers\\.(?:"${MCP_NAME}"|${MCP_NAME})\\]`, "m").test(toml);
const tomlString = (s: string) => JSON.stringify(s);
const tomlMcpBlock = (cmd: string[], kind: AgentKind) =>
  `\n# Agent Tracking (agregado desde Agent Tracking; bórralo para desconectar)\n[mcp_servers.${MCP_NAME}]\ncommand = ${tomlString(cmd[0]!)}\nargs = [${[...cmd.slice(1), "--agent", kind].map(tomlString).join(", ")}]\n`;
const tomlWithoutMcp = (toml: string) =>
  toml.replace(new RegExp(`\\n?# Agent Tracking \\(agregado[^\\n]*\\n\\[mcp_servers\\.${MCP_NAME}\\][\\s\\S]*?(?=\\n\\[|$)`), "").replace(/\n{3,}/g, "\n\n");

export async function agentStatus(kind: AgentKind, opts: { home?: string } = {}): Promise<AgentStatus> {
  const home = homeDir(opts);
  const p = paths(kind, home);
  const installed = !!Bun.which(BINARIES[kind]) || existsSync(p.dir);
  const hooksConfig = readJson(await readText(p.hooks).catch(() => null));
  let mcp = false;
  if (kind === "codex") mcp = tomlHasMcp(await readText(p.mcp));
  else {
    const config = kind === "gemini-cli" ? hooksConfig : readJson(await readText(p.mcp).catch(() => null));
    // Claude Code also keeps MCP servers per project in ~/.claude.json; any of them counts.
    const perProject = kind === "claude-code" ? Object.values((config.projects ?? {}) as Record<string, { mcpServers?: Record<string, unknown> }>) : [];
    mcp = !!config.mcpServers?.[MCP_NAME] || perProject.some((proj) => !!proj?.mcpServers?.[MCP_NAME]);
  }
  const events = kind === "gemini-cli" ? GEMINI_EVENTS : kind === "codex" ? CODEX_EVENTS : CLAUDE_EVENTS;
  const hooks = hasHooks(hooksConfig, events);
  return { kind, installed, mcp, hooks, hooksOutdated: !hooks && hasHooks(hooksConfig, events, isOurs), configPath: p.hooks };
}

/** What connecting `kind` would change. Nothing is written here. */
export async function connectPlan(kind: AgentKind, opts: ConnectOptions): Promise<FileChange[]> {
  const home = homeDir(opts);
  const p = paths(kind, home);
  const hook = hookCommand(opts.serverUrl, kind);
  const changes: FileChange[] = [];
  const status = await agentStatus(kind, { home });

  if (kind === "claude-code") {
    if (!status.hooks) {
      const before = await readText(p.hooks);
      const after = json(withHooks(readJson(before), CLAUDE_EVENTS, { type: "command", command: hook, timeout: 5 }));
      changes.push({ type: "file", path: p.hooks, description: "Hooks de Claude Code para ver en vivo lo que hace y resumir cada trabajo", before, after });
    }
    if (!status.mcp) {
      changes.push({
        type: "command",
        argv: ["claude", "mcp", "add", "--scope", "user", MCP_NAME, "--", ...opts.mcpCommand, "--agent", "claude-code"],
        description: "Registra el servidor MCP de Agent Tracking en Claude Code (para todos tus proyectos)",
      });
    }
  }

  if (kind === "codex") {
    if (!status.mcp) {
      const before = await readText(p.mcp);
      changes.push({ type: "file", path: p.mcp, description: "Servidor MCP de Agent Tracking en Codex", before, after: `${(before ?? "").trimEnd()}\n${tomlMcpBlock(opts.mcpCommand, "codex")}`.trimStart() });
    }
    if (!status.hooks) {
      const before = await readText(p.hooks);
      const after = json(withHooks(readJson(before), CODEX_EVENTS, { type: "command", command: hook }));
      changes.push({
        type: "file",
        path: p.hooks,
        description: "Hooks de Codex. Codex no los ejecuta hasta que confías en ellos: abre Codex, escribe /hooks y confía en los de Agent Tracking",
        before,
        after,
      });
    }
  }

  if (kind === "gemini-cli" && (!status.mcp || !status.hooks)) {
    const before = await readText(p.hooks);
    let config = readJson(before);
    if (!status.mcp) {
      const [command, ...args] = opts.mcpCommand;
      config = { ...config, mcpServers: { ...(config.mcpServers ?? {}), [MCP_NAME]: { command, args: [...args, "--agent", "gemini-cli"] } } };
    }
    if (!status.hooks) config = withHooks(config, GEMINI_EVENTS, { name: MCP_NAME, type: "command", command: hook, timeout: 5000 }, "*");
    changes.push({ type: "file", path: p.hooks, description: "Servidor MCP y hooks de Gemini CLI", before, after: json(config) });
  }
  return changes;
}

/** What disconnecting `kind` would change: only what Agent Tracking added. */
export async function disconnectPlan(kind: AgentKind, opts: { home?: string } = {}): Promise<FileChange[]> {
  const home = homeDir(opts);
  const p = paths(kind, home);
  const changes: FileChange[] = [];
  const hooksBefore = await readText(p.hooks);
  if (hooksBefore) {
    let config = withoutHooks(readJson(hooksBefore));
    if (kind === "gemini-cli" && config.mcpServers?.[MCP_NAME]) {
      const { [MCP_NAME]: _gone, ...rest } = config.mcpServers;
      config = Object.keys(rest).length ? { ...config, mcpServers: rest } : (({ mcpServers: _m, ...c }) => c)(config);
    }
    const after = json(config);
    if (after !== json(readJson(hooksBefore))) changes.push({ type: "file", path: p.hooks, description: "Quita los hooks (y el MCP en Gemini) de Agent Tracking", before: hooksBefore, after });
  }
  if (kind === "codex") {
    const before = await readText(p.mcp);
    if (before && tomlHasMcp(before)) changes.push({ type: "file", path: p.mcp, description: "Quita el servidor MCP de Agent Tracking", before, after: tomlWithoutMcp(before) });
  }
  if (kind === "claude-code" && (await agentStatus(kind, { home })).mcp) {
    changes.push({ type: "command", argv: ["claude", "mcp", "remove", "--scope", "user", MCP_NAME], description: "Quita el servidor MCP de Agent Tracking de Claude Code" });
  }
  return changes;
}

/** Writes the planned changes, keeping a .bak of every file it replaces. */
export async function applyChanges(changes: FileChange[], run: (argv: string[]) => Promise<{ ok: boolean; stderr: string }> = defaultRun) {
  const done: string[] = [];
  for (const change of changes) {
    if (change.type === "command") {
      const res = await run(change.argv);
      if (!res.ok) throw new Error(`${change.argv.slice(0, 3).join(" ")} falló: ${res.stderr.split("\n").filter(Boolean).at(-1) ?? "sin detalle"}`);
      done.push(change.argv.join(" "));
      continue;
    }
    const current = await readText(change.path);
    if (current !== change.before) throw new Error(`${change.path} cambió desde que se preparó el plan: vuelve a revisarlo`);
    await mkdir(dirname(change.path), { recursive: true });
    if (current !== null) await copyFile(change.path, `${change.path}.bak`);
    await writeFile(change.path, change.after);
    done.push(change.path);
  }
  return done;
}

async function defaultRun(argv: string[]) {
  try {
    const proc = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
    const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
    return { ok: code === 0, stderr };
  } catch (e) {
    return { ok: false, stderr: (e as Error).message };
  }
}
