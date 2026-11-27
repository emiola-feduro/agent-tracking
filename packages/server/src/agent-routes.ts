import { AGENT_KINDS, AGENTS, agentStatus, applyChanges, connectPlan, disconnectPlan, isAgentKind, type AgentKind } from "@agent-tracking/agents";
import { schema as s, type Db } from "@agent-tracking/db";
import { desc, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { join } from "node:path";
import { isLocalOrigin } from "./origin";

const kindOf = (c: Context): AgentKind => {
  const kind = c.req.param("kind");
  if (!isAgentKind(kind)) throw new HTTPException(404, { message: "Agente desconocido" });
  return kind;
};

/** Changing an agent's configuration is only allowed from this machine's own pages. */
const localOnly = (c: Context) => {
  if (!isLocalOrigin(c.req.header("origin"))) throw new HTTPException(403, { message: "Solo se puede hacer desde Agent Tracking en este equipo" });
};

/** Only what the person saw is applied: the plan they confirmed must match the current one. */
const sameAsShown = async (c: Context, plan: unknown) => {
  const body = (await c.req.json().catch(() => null)) as { plan?: unknown } | null;
  if (JSON.stringify(body?.plan) !== JSON.stringify(plan)) {
    throw new HTTPException(409, { message: "La configuración cambió desde que la revisaste: vuelve a abrir el plan" });
  }
};

/**
 * Coding agents on this machine and their connection to Agent Tracking.
 *
 *   GET  /agents                         status of each agent (installed, MCP, hooks, last activity)
 *   GET  /agents/:kind/connect-plan      what connecting would change (files before/after, commands)
 *   POST /agents/:kind/connect           applies that plan (keeps .bak copies)
 *   GET  /agents/:kind/disconnect-plan   what disconnecting would change
 *   POST /agents/:kind/disconnect
 */
export function agentRoutes(db: Db) {
  const app = new Hono();
  const serverUrl = (c: Context) => new URL(c.req.url).origin;

  app.get("/agents", async (c) => {
    const list = await Promise.all(
      AGENT_KINDS.map(async (kind) => {
        const [last] = await db
          .select({ at: s.agentTurns.startedAt })
          .from(s.agentTurns)
          .where(eq(s.agentTurns.agent, kind))
          .orderBy(desc(s.agentTurns.startedAt))
          .limit(1);
        return { ...(await agentStatus(kind)), label: AGENTS[kind].label, contextFile: AGENTS[kind].contextFile, lastSeen: last?.at ?? null };
      }),
    );
    return c.json(list);
  });

  app.get("/agents/:kind/connect-plan", async (c) => c.json(await connectPlan(kindOf(c), { serverUrl: serverUrl(c) })));
  app.post("/agents/:kind/connect", async (c) => {
    localOnly(c);
    const kind = kindOf(c);
    const plan = await connectPlan(kind, { serverUrl: serverUrl(c) });
    await sameAsShown(c, plan);
    const done = await applyChanges(plan).catch((e: Error) => {
      throw new HTTPException(409, { message: e.message });
    });
    return c.json({ done, status: await agentStatus(kind) });
  });

  app.get("/agents/:kind/disconnect-plan", async (c) => c.json(await disconnectPlan(kindOf(c))));
  app.post("/agents/:kind/disconnect", async (c) => {
    localOnly(c);
    const kind = kindOf(c);
    const plan = await disconnectPlan(kind);
    await sameAsShown(c, plan);
    const done = await applyChanges(plan).catch((e: Error) => {
      throw new HTTPException(409, { message: e.message });
    });
    return c.json({ done, status: await agentStatus(kind) });
  });

  return app;
}
