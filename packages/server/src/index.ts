import { assistantConfigFromEnv } from "@agent-tracking/assistant";
import { openDb } from "@agent-tracking/db";
import { join, normalize } from "node:path";
import { createApp, type AppEvent } from "./app";

const port = Number(process.env.PORT ?? 4317);
const TOPIC = "events";

const db = openDb();
let server: ReturnType<typeof Bun.serve> | undefined;
const emit = (e: AppEvent) => server?.publish(TOPIC, JSON.stringify(e));
const assistant = assistantConfigFromEnv();
const app = createApp(db, { emit, assistant });

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
console.log(assistant ? "Asistente con Claude activo" : "Asistente con Claude desactivado (falta ANTHROPIC_API_KEY)");
