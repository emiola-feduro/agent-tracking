import type { Tracker } from "@agent-tracking/tracking";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
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

  return async (req: Request): Promise<Response> => {
    // Browsers on other sites must not drive a local agent server (DNS rebinding, CSRF).
    const origin = req.headers.get("origin");
    if (origin && !LOCAL_ORIGIN.test(origin)) return jsonError(403, "Origen no permitido");

    const sessionId = req.headers.get("mcp-session-id");
    if (sessionId) {
      const transport = sessions.get(sessionId);
      if (!transport) return jsonError(404, "Sesión MCP no encontrada");
      return transport.handleRequest(req);
    }
    if (req.method !== "POST") return jsonError(400, "Falta la cabecera mcp-session-id");

    const url = new URL(req.url);
    const agent = url.searchParams.get("agent");
    const server = createMcpServer(tracker, {
      project: url.searchParams.get("project") ?? req.headers.get("x-agent-tracking-project") ?? undefined,
      actor: agent ? `agent:${agent}` : undefined,
    }, deps);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (id) => void sessions.set(id, transport),
      onsessionclosed: (id) => void sessions.delete(id),
    });
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };
    await server.connect(transport);
    return transport.handleRequest(req);
  };
}
