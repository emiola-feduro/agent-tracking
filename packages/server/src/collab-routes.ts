import { CollabError, createCollabClient, ROLES, type CollabClient } from "@agent-tracking/collab";
import type { Db } from "@agent-tracking/db";
import { inspectRepo } from "@agent-tracking/git";
import {
  clearCollabConnection,
  collabClientFor,
  getCollabConnection,
  getSyncBase,
  joinProject,
  setCollabConnection,
  shareProject,
  syncProject,
  type Emit,
} from "@agent-tracking/tracking";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";

export type CollabRouteOptions = {
  emit: Emit;
  /** Fetch used to reach the shared server; tests route it to an in-process server. */
  fetch?: typeof fetch;
};

const connectInput = z.object({
  url: z.string().trim().url(),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  /** Present to create the account; absent to sign in. */
  name: z.string().trim().min(1).max(100).optional(),
});
const joinInput = z.object({ projectId: z.string().min(1).max(100), repoPath: z.string().min(1) });
const memberInput = z.object({ email: z.string().trim().email(), role: z.enum(ROLES) });
const presenceInput = z.object({ activity: z.string().max(200).default("") });

/** Turns the shared server's answers into this API's errors (the UI shows the message). */
async function remote<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (e) {
    if (e instanceof CollabError) throw new HTTPException(e.status as ContentfulStatusCode, { message: e.message });
    throw e;
  }
}

/**
 * Collaboration through a shared server (packages/collab), for the desktop app and the local server:
 *
 *   GET    /collab                          → { connected, url, user } (the token never leaves this server)
 *   POST   /collab/connect                  → signs in, or creates the account when `name` comes
 *   DELETE /collab                          → signs out and forgets the connection
 *   GET    /collab/projects                 → projects shared with this person
 *   POST   /collab/join                     → brings a shared project to this machine
 *   GET    /projects/:id/collab             → whether it is shared, the role and the last synced revision
 *   POST   /projects/:id/collab/share       → shares it (this person becomes its owner)
 *   POST   /projects/:id/collab/sync        → merges with the server and pushes local changes
 *   GET    /projects/:id/collab/members     → members with their roles
 *   PUT    /projects/:id/collab/members     → adds a member or changes a role (owner)
 *   DELETE /projects/:id/collab/members/:u  → removes a member (owner) or leaves the project
 *   POST   /projects/:id/collab/presence    → heartbeat; answers who is working on it now
 */
export function collabRoutes(db: Db, opts: CollabRouteOptions) {
  const app = new Hono();
  const { emit } = opts;

  const clientOr401 = async (): Promise<CollabClient> => {
    const client = await collabClientFor(db, opts.fetch);
    if (!client) throw new HTTPException(401, { message: "Conéctate primero a un servidor compartido" });
    return client;
  };
  const body = async <T>(c: { req: { json: () => Promise<unknown> } }, schema: z.ZodType<T>) => {
    const parsed = schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw new HTTPException(400, { message: z.prettifyError(parsed.error) });
    return parsed.data;
  };
  const refreshed = (projectId: string) => emit({ type: "changed", projectId, entity: "project", id: projectId });

  app.get("/collab", async (c) => {
    const conn = await getCollabConnection(db);
    return c.json(conn ? { connected: true, url: conn.url, user: conn.user } : { connected: false, url: null, user: null });
  });

  app.post("/collab/connect", async (c) => {
    const { url, email, password, name } = await body(c, connectInput);
    const client = createCollabClient({ url, fetch: opts.fetch });
    const { user, token } = await remote(() => (name ? client.register(email, name, password) : client.login(email, password)));
    await setCollabConnection(db, { url: url.replace(/\/+$/, ""), token, user });
    return c.json({ connected: true, url, user });
  });

  app.delete("/collab", async (c) => {
    const client = await collabClientFor(db, opts.fetch);
    await client?.logout().catch(() => {});
    await clearCollabConnection(db);
    return c.body(null, 204);
  });

  app.get("/collab/projects", async (c) => {
    const client = await clientOr401();
    return c.json(await remote(() => client.projects()));
  });

  app.post("/collab/join", async (c) => {
    const { projectId, repoPath } = await body(c, joinInput);
    const repo = await inspectRepo(repoPath.trim());
    if (!repo) throw new HTTPException(400, { message: "La ruta no es un repositorio git (debe ser absoluta)" });
    const client = await clientOr401();
    const result = await remote(() => joinProject(db, client, projectId, repo.root));
    emit({ type: "project.created", projectId });
    return c.json(result);
  });

  app.get("/projects/:id/collab", async (c) => {
    const id = c.req.param("id");
    const client = await collabClientFor(db, opts.fetch);
    const base = await getSyncBase(db, id);
    if (!client) return c.json({ connected: false, shared: false, role: null, revision: null, syncedRevision: base?.revision ?? null });
    try {
      const p = await client.project(id);
      return c.json({ connected: true, shared: true, role: p.role, revision: p.revision, updatedAt: p.updatedAt, syncedRevision: base?.revision ?? null });
    } catch (e) {
      if (e instanceof CollabError && e.status === 404) return c.json({ connected: true, shared: false, role: null, revision: null, syncedRevision: null });
      throw e instanceof CollabError ? new HTTPException(e.status as ContentfulStatusCode, { message: e.message }) : e;
    }
  });

  app.post("/projects/:id/collab/share", async (c) => {
    const id = c.req.param("id");
    const client = await clientOr401();
    return c.json(await remote(() => shareProject(db, client, id)));
  });

  app.post("/projects/:id/collab/sync", async (c) => {
    const id = c.req.param("id");
    const client = await clientOr401();
    const result = await remote(() => syncProject(db, client, id));
    if (result.pulled) refreshed(id);
    return c.json(result);
  });

  app.get("/projects/:id/collab/members", async (c) => {
    const client = await clientOr401();
    return c.json(await remote(() => client.members(c.req.param("id"))));
  });

  app.put("/projects/:id/collab/members", async (c) => {
    const { email, role } = await body(c, memberInput);
    const client = await clientOr401();
    return c.json(await remote(() => client.setMember(c.req.param("id"), email, role)));
  });

  app.delete("/projects/:id/collab/members/:userId", async (c) => {
    const client = await clientOr401();
    await remote(() => client.removeMember(c.req.param("id"), c.req.param("userId")));
    return c.body(null, 204);
  });

  app.post("/projects/:id/collab/presence", async (c) => {
    const { activity } = await body(c, presenceInput);
    const client = await clientOr401();
    return c.json(await remote(() => client.heartbeat(c.req.param("id"), activity)));
  });

  return app;
}
