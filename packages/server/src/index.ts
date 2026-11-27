import { PROVIDER_INFO, providerOf, resolveAssistantProviders } from "@agent-tracking/assistant";
import { openDb, schema } from "@agent-tracking/db";
import { isAllowedOrigin } from "./origin";
import { createMcpHttpHandler } from "@agent-tracking/mcp";
import { createRepoInference, createTracker, fillRequirementCodes, onRepoImport } from "@agent-tracking/tracking";
import { join, normalize } from "node:path";
import { createApp, type AppEvent } from "./app";
import { createRepoWatchers, type RepoWatchers } from "./repo-watchers";

const port = Number(process.env.PORT ?? 4317);
const TOPIC = "events";

const db = openDb();
let server: ReturnType<typeof Bun.serve> | undefined;
let repoWatchers: RepoWatchers | undefined;
const emit = (e: AppEvent) => {
  server?.publish(TOPIC, JSON.stringify(e));
  // Keep a watcher on every project repository: new, imported, moved or deleted projects.
  if (e.type === "project.created" || (e.type === "changed" && e.entity === "project")) void repoWatchers?.ensure(e.projectId);
  if (e.type === "project.deleted") repoWatchers?.stop(e.projectId);
};
const tracker = createTracker(db, { emit });
// Requirements written by older code (another process that outlived an update) may lack a code.
for (const p of await db.select({ id: schema.projects.id }).from(schema.projects)) {
  const filled = fillRequirementCodes(db, p.id);
  if (filled) console.log(`Se asignaron ${filled} códigos de requerimiento que faltaban`);
}
// Repository analysis: files, symbols and tests show up even when an agent does not report them
// (AGENT_TRACKING_WATCH=0 disables the watchers; sync_repo and the API still work on demand).
const inference = createRepoInference(db, tracker);
repoWatchers = createRepoWatchers(db, inference, {
  // Branch switches (also from a terminal) refresh the branch shown in the UI.
  onBranchChange: (projectId) => emit({ type: "changed", projectId, entity: "repo" }),
});
const syncRepo = (projectId: string, scope: "changes" | "all") => repoWatchers!.sync(projectId, scope);
// Changes that arrived through git (pull, merge, checkout) were imported: analyse the code again so
// symbols, lines and tests match the new checkout, and refresh the UI.
onRepoImport((projectId) => {
  void syncRepo(projectId, "all");
  emit({ type: "changed", projectId, entity: "project", id: projectId });
});
// Claude first (API key, then the local Claude Code login), then OpenAI, Gemini, Codex CLI and Gemini CLI (see README).
const { available: assistantProviders, active: assistant } = await resolveAssistantProviders();
// Background GitHub polling for projects open in the UI (GITHUB_POLL_MS=0 disables it).
/** Where each kind of agent last worked, from its hooks; recent enough to trust for 30 minutes. */
const agentDirs = new Map<string, { dir: string; at: number }>();
const app = createApp(db, {
  onAgentDir: (agent, dir) => void agentDirs.set(agent, { dir, at: Date.now() }),
  tracker,
  syncRepo,
  assistant,
  assistantProviders,
  github: { watcher: { intervalMs: Number(process.env.GITHUB_POLL_MS ?? 60_000) } },
});
/** MCP for agents (Streamable HTTP). stdio agents reach it through packages/mcp/src/stdio.ts. */
const mcp = createMcpHttpHandler(tracker, {
  syncRepo,
  lastAgentDir: (agent) => {
    const seen = agentDirs.get(agent);
    return seen && Date.now() - seen.at < 30 * 60_000 ? seen.dir : null;
  },
});

/** SPA compilada (apps/web/build). En desktop la sirve Tauri; en web, este mismo proceso. */
const webRoot = process.env.AGENT_TRACKING_WEB ?? join(import.meta.dir, "..", "..", "..", "apps", "web", "build");
async function serveWeb(pathname: string): Promise<Response> {
  const file = Bun.file(join(webRoot, normalize(pathname).replace(/^(\.\.[/\\])+/, "")));
  // Hashed bundles never change; index.html always revalidates so a new build is picked up on reload.
  if (pathname !== "/" && pathname !== "/index.html" && (await file.exists())) {
    const immutable = pathname.startsWith("/assets/");
    return new Response(file, { headers: { "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache" } });
  }
  const index = Bun.file(join(webRoot, "index.html"));
  return (await index.exists())
    ? new Response(index, { headers: { "Cache-Control": "no-cache" } })
    : new Response("UI no compilada: bun run build:web", { status: 404 });
}

server = Bun.serve({
  port,
  hostname: process.env.HOST ?? "127.0.0.1",
  fetch(req, srv) {
    // Eventos en tiempo real para la UI: ws://host:port/ws
    const { pathname } = new URL(req.url);
    if (pathname === "/ws") {
      // Same rule as the API: another site in the browser must not listen to project events.
      if (!isAllowedOrigin(req.headers.get("origin"), req.headers.get("host"))) return new Response("Origen no permitido", { status: 403 });
      return srv.upgrade(req, { data: undefined }) ? undefined : new Response("Upgrade requerido", { status: 426 });
    }
    if (pathname === "/mcp" && !isAllowedOrigin(req.headers.get("origin"), req.headers.get("host"))) {
      return new Response("Origen no permitido", { status: 403 });
    }
    if (pathname.startsWith("/api/")) return app.fetch(req);
    if (pathname === "/mcp") return mcp(req);
    return serveWeb(pathname);
  },
  websocket: {
    open: (ws) => {
      ws.subscribe(TOPIC);
    },
    message: () => {},
  },
});

console.log(`Agent Tracking API escuchando en http://${server.hostname}:${server.port}`);
if (process.env.AGENT_TRACKING_WATCH !== "0") {
  const watched = await repoWatchers.startAll();
  console.log(`Analizando ${watched} repositorio(s) de proyectos en segundo plano`);
}
const otherProviders = assistantProviders.filter((p) => p !== assistant).map((p) => PROVIDER_INFO[providerOf(p)].label);
console.log(
  (!assistant
    ? assistantProviders.length
      ? "Asistente desactivado (el proveedor pedido en AGENT_TRACKING_ASSISTANT_PROVIDER no está disponible)"
      : "Asistente desactivado (sin claves de Claude, OpenAI ni Gemini, ni sesión de Claude Code, Codex CLI o Gemini CLI)"
    : `Asistente activo con ${PROVIDER_INFO[providerOf(assistant)].label}`) +
    (otherProviders.length ? `; disponibles para elegir: ${otherProviders.join(", ")}` : ""),
);
