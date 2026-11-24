#!/usr/bin/env bun
/**
 * MCP over stdio, for agents that launch their tools as a subprocess (Claude Code, Cursor, etc.):
 *
 *   bun packages/mcp/src/stdio.ts [--project <id|path>] [--agent <name>] [--url <server>] [--db <file>]
 *
 * With the Agent Tracking server running (default http://127.0.0.1:4317) it forwards every call to
 * its `/mcp` endpoint, so the UI updates live. Without it, `--db` (or AGENT_TRACKING_DB) writes
 * straight to the database; the UI then catches up the next time it loads.
 */
import { openDb } from "@agent-tracking/db";
import { createRepoInference, createTracker } from "@agent-tracking/tracking";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { createMcpServer, SERVER_INFO, SERVER_INSTRUCTIONS } from "./server";

const { values: flags } = parseArgs({
  options: {
    project: { type: "string" },
    agent: { type: "string" },
    url: { type: "string" },
    db: { type: "string" },
    local: { type: "boolean", default: false },
  },
});

const project = flags.project ?? process.cwd();
const projectRef = project.startsWith("/") || project.startsWith(".") ? resolve(project) : project;
const baseUrl = (flags.url ?? process.env.AGENT_TRACKING_URL ?? "http://127.0.0.1:4317").replace(/\/+$/, "");
const dbPath = flags.db ?? process.env.AGENT_TRACKING_DB;

const serverIsUp = async () => {
  try {
    const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
};

/** Forwards tools to the running server. The upstream session opens once the agent says who it is. */
async function runProxy() {
  const server = new Server(SERVER_INFO, { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS });
  let upstream: Promise<Client> | undefined;
  const connect = () =>
    (upstream ??= (async () => {
      const url = new URL(`${baseUrl}/mcp`);
      url.searchParams.set("project", projectRef);
      url.searchParams.set("agent", flags.agent ?? server.getClientVersion()?.name ?? "desconocido");
      const client = new Client({ name: "agent-tracking-stdio", version: SERVER_INFO.version });
      await client.connect(new StreamableHTTPClientTransport(url));
      return client;
    })());
  server.setRequestHandler(ListToolsRequestSchema, async (req) => (await connect()).listTools(req.params));
  server.setRequestHandler(CallToolRequestSchema, async (req) => (await connect()).callTool(req.params));
  server.onclose = () => void upstream?.then((c) => c.close()).catch(() => {});
  await server.connect(new StdioServerTransport());
}

async function runLocal() {
  const db = openDb(dbPath);
  const tracker = createTracker(db);
  // Without the server there is no watcher, but sync_repo can still analyse on demand.
  const inference = createRepoInference(db, tracker);
  const server = createMcpServer(
    tracker,
    { project: projectRef, actor: flags.agent ? `agent:${flags.agent}` : undefined },
    { syncRepo: (id, scope) => (scope === "all" ? inference.syncAll(id) : inference.syncWorkingTree(id)) },
  );
  await server.connect(new StdioServerTransport());
}

if (!flags.local && (await serverIsUp())) {
  await runProxy();
} else if (dbPath) {
  console.error(`[agent-tracking] Servidor no disponible en ${baseUrl}; escribiendo directo en ${dbPath}`);
  await runLocal();
} else {
  console.error(
    `[agent-tracking] No hay servidor de Agent Tracking en ${baseUrl}. Inícialo (bun run start) o pasa --db <archivo> para trabajar sin él.`,
  );
  process.exit(1);
}
