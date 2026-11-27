import type { Tracker } from "@agent-tracking/tracking";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer, type McpDeps } from "./server";

const LOCAL_ORIGIN = /^(https?|tauri):\/\/(localhost|127\.0\.0\.1|\[::1\]|tauri\.localhost)(:\d+)?$/;

const jsonError = (status: number, message: string) =>
  Response.json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }, { status });

/**
 * Streamable HTTP endpoint (mount it at `/mcp`). One MCP session per agent connection, so the
 * agent's name from the handshake is known on every call. The default project comes from
 * `?project=<id|path>` or the `X-Agent-Tracking-Project` header; `?agent=<name>` overrides the actor.
 */
export function createMcpHttpHandler(tracker: Tracker, deps: McpDeps = {}) {
  const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>();

  /** A server and transport for one session; `id` reuses a session id the client already has. */
  const open = async (url: URL, req: Request, id?: string) => {
    const agent = url.searchParams.get("agent");
    const server = createMcpServer(
      tracker,
      { project: url.searchParams.get("project") ?? req.headers.get("x-agent-tracking-project") ?? undefined, actor: agent ? `agent:${agent}` : undefined },
      deps,
    );
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => id ?? crypto.randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (sid) => void sessions.set(sid, transport),
      onsessionclosed: (sid) => void sessions.delete(sid),
    });
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };
    await server.connect(transport);
    return transport;
  };

  /**
   * Sessions live in memory, so a restart of the server (every update, with --watch) forgets them,
   * and agents do not open a new one by themselves: they would need a manual reconnect. A request
   * for an unknown session revives it under the same id, with a handshake done here on the agent's
   * behalf (its name comes from `?agent=`, which the connection URL carries).
   */
  const revive = async (id: string, url: URL, req: Request) => {
    const transport = await open(url, req, id);
    const post = (body: object) =>
      transport.handleRequest(
        new Request(req.url, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
          body: JSON.stringify(body),
        }),
      );
    const init = await post({
      jsonrpc: "2.0",
      id: "agent-tracking-revive",
      method: "initialize",
      params: { protocolVersion: LATEST_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: url.searchParams.get("agent") ?? "desconocido", version: "0" } },
    });
    if (!init.ok) return null;
    await post({ jsonrpc: "2.0", method: "notifications/initialized" });
    return transport;
  };

  return async (req: Request): Promise<Response> => {
    // Browsers on other sites must not drive a local agent server (DNS rebinding, CSRF).
    const origin = req.headers.get("origin");
    if (origin && !LOCAL_ORIGIN.test(origin)) return jsonError(403, "Origen no permitido");

    const url = new URL(req.url);
    const sessionId = req.headers.get("mcp-session-id");
    if (sessionId) {
      if (req.method === "DELETE" && !sessions.has(sessionId)) return new Response(null, { status: 200 });
      const transport = sessions.get(sessionId) ?? (await revive(sessionId, url, req));
      if (!transport) return jsonError(404, "Sesión MCP no encontrada");
      // The client sends the protocol version it agreed on; a revived session accepts it like the original.
      return transport.handleRequest(req);
    }
    if (req.method !== "POST") return jsonError(400, "Falta la cabecera mcp-session-id");
    const transport = await open(url, req);
    return transport.handleRequest(req);
  };
}
