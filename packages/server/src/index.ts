import { providerOf, resolveAssistantConfig } from "@agent-tracking/assistant";
import { openDb } from "@agent-tracking/db";
import { createMcpHttpHandler } from "@agent-tracking/mcp";
import { createRepoInference, createTracker } from "@agent-tracking/tracking";
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
// Repository analysis: files, symbols and tests show up even when an agent does not report them
// (AGENT_TRACKING_WATCH=0 disables the watchers; sync_repo and the API still work on demand).
const inference = createRepoInference(db, tracker);
repoWatchers = createRepoWatchers(db, inference);
const syncRepo = (projectId: string, scope: "changes" | "all") => repoWatchers!.sync(projectId, scope);
// An API key, or else the local Claude Code CLI with the person's own login (see README).
const assistant = await resolveAssistantConfig();
// Background GitHub polling for projects open in the UI (GITHUB_POLL_MS=0 disables it).
const app = createApp(db, {
  tracker,
  syncRepo,
  assistant,
  github: { watcher: { intervalMs: Number(process.env.GITHUB_POLL_MS ?? 60_000) } },
});
/** MCP for agents (Streamable HTTP). stdio agents reach it through packages/mcp/src/stdio.ts. */
const mcp = createMcpHttpHandler(tracker, { syncRepo });

/** SPA compilada (apps/web/build). En desktop la sirve Tauri; en web, este mismo proceso. */
const webRoot = process.env.AGENT_TRACKING_WEB ?? join(import.meta.dir, "..", "..", "..", "apps", "web", "build");
async function serveWeb(pathname: string): Promise<Response> {
  const file = Bun.file(join(webRoot, normalize(pathname).replace(/^(\.\.[/\\])+/, "")));
  if (pathname !== "/" && (await file.exists())) return new Response(file);
  const index = Bun.file(join(webRoot, "index.html"));
  return (await index.exists()) ? new Response(index) : new Response("UI no compilada: bun run build:web", { status: 404 });
}

server = Bun.serve({
  port,
  hostname: process.env.HOST ?? "127.0.0.1",
  fetch(req, srv) {
    // Eventos en tiempo real para la UI: ws://host:port/ws
    const { pathname } = new URL(req.url);
    if (pathname === "/ws") {
      return srv.upgrade(req, { data: undefined }) ? undefined : new Response("Upgrade requerido", { status: 426 });
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
console.log(
  !assistant
    ? "Asistente con Claude desactivado (sin ANTHROPIC_API_KEY ni sesión de Claude Code)"
    : providerOf(assistant) === "api"
      ? "Asistente con Claude activo (API key)"
      : "Asistente con Claude activo (tu Claude Code instalado)",
);
