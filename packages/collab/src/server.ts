import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { can, ROLES, type Action } from "./roles";
import type { CollabStore, User } from "./store";

type Env = { Variables: { user: User; token: string } };

const credentials = z.object({ email: z.string().email(), password: z.string().min(8).max(200) });
const registration = credentials.extend({ name: z.string().trim().min(1).max(100) });
const tree = z.record(z.string(), z.string());
const share = z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(200), tree });
const push = z.object({ baseRevision: z.number().int().min(1), name: z.string().min(1).max(200), tree });
const member = z.object({ email: z.string().email(), role: z.enum(ROLES) });
const heartbeat = z.object({ activity: z.string().max(200).default("") });

export type CollabServerOptions = {
  /** Whether anyone can create an account (COLLAB_SIGNUP=0 closes it once the team is in). */
  allowSignup?: boolean;
};

async function body<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new HTTPException(400, { message: "Datos no válidos" });
  return parsed.data;
}

/**
 * The shared server several people sync their projects with: accounts and session tokens, projects
 * shared with members and roles, versioned project trees and presence. Mounted under /api.
 */
export function createCollabServer(store: CollabStore, opts: CollabServerOptions = {}) {
  const app = new Hono<Env>().basePath("/api");

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: "Error del servidor" }, 500);
  });

  app.get("/health", (c) => c.json({ ok: true, service: "agent-tracking-collab" }));

  app.post("/auth/register", async (c) => {
    if (opts.allowSignup === false) throw new HTTPException(403, { message: "El registro está cerrado en este servidor" });
    const { email, name, password } = await body(c, registration);
    const result = await store.register(email, name, password);
    if (!result) throw new HTTPException(409, { message: "Ya existe una cuenta con ese correo" });
    return c.json(result, 201);
  });

  app.post("/auth/login", async (c) => {
    const { email, password } = await body(c, credentials);
    const result = await store.login(email, password);
    if (!result) throw new HTTPException(401, { message: "Correo o contraseña incorrectos" });
    return c.json(result);
  });

  // Everything below needs a session token.
  app.use("*", async (c, next) => {
    const token = c.req.header("authorization")?.match(/^Bearer (.+)$/)?.[1];
    const user = token ? await store.userByToken(token) : null;
    if (!user || !token) throw new HTTPException(401, { message: "Inicia sesión en el servidor compartido" });
    c.set("user", user);
    c.set("token", token);
    await next();
  });

  /** The caller's role in the project; 404 when it does not exist or they cannot see it. */
  async function allow(c: Context<Env>, action: Action) {
    const projectId = c.req.param("id")!;
    const role = await store.roleOf(projectId, c.get("user").id);
    if (!role) throw new HTTPException(404, { message: "Proyecto no encontrado" });
    if (!can(role, action)) throw new HTTPException(403, { message: "Tu rol no permite esta acción" });
    return { projectId, role };
  }

  app.get("/me", (c) => c.json({ user: c.get("user") }));

  app.post("/auth/logout", async (c) => {
    await store.logout(c.get("token"));
    return c.body(null, 204);
  });

  app.get("/projects", async (c) => c.json({ projects: await store.projectsOf(c.get("user").id) }));

  app.post("/projects", async (c) => {
    const { id, name, tree } = await body(c, share);
    if (!(await store.createProject(id, name, tree, c.get("user").id))) throw new HTTPException(409, { message: "El proyecto ya está compartido" });
    return c.json({ revision: 1, role: "owner" }, 201);
  });

  app.get("/projects/:id", async (c) => {
    const { projectId, role } = await allow(c, "read");
    return c.json({ ...(await store.project(projectId))!, role });
  });

  app.put("/projects/:id/tree", async (c) => {
    const { projectId } = await allow(c, "push");
    const { baseRevision, name, tree } = await body(c, push);
    const revision = await store.pushTree(projectId, baseRevision, tree, name, c.get("user").id);
    if (revision == null) {
      const current = await store.project(projectId);
      return c.json({ error: "Alguien sincronizó antes; trae los cambios y vuelve a intentar", revision: current?.revision }, 409);
    }
    return c.json({ revision });
  });

  app.delete("/projects/:id", async (c) => {
    const { projectId } = await allow(c, "deleteProject");
    await store.deleteProject(projectId);
    return c.body(null, 204);
  });

  app.get("/projects/:id/members", async (c) => {
    const { projectId } = await allow(c, "read");
    return c.json({ members: await store.members(projectId) });
  });

  app.put("/projects/:id/members", async (c) => {
    const { projectId } = await allow(c, "manageMembers");
    const { email, role } = await body(c, member);
    const current = (await store.members(projectId)).find((m) => m.email === email.trim().toLowerCase());
    if (current?.role === "owner" && role !== "owner" && (await store.ownerCount(projectId)) <= 1) {
      throw new HTTPException(409, { message: "El proyecto necesita al menos una persona responsable" });
    }
    const saved = await store.setMember(projectId, email, role);
    if (!saved) throw new HTTPException(404, { message: "No hay una cuenta con ese correo en el servidor" });
    return c.json({ member: saved });
  });

  app.delete("/projects/:id/members/:userId", async (c) => {
    const userId = c.req.param("userId");
    // Anyone can leave a project; removing someone else needs the owner role.
    const { projectId } = await allow(c, userId === c.get("user").id ? "read" : "manageMembers");
    const target = await store.roleOf(projectId, userId);
    if (target === "owner" && (await store.ownerCount(projectId)) <= 1) {
      throw new HTTPException(409, { message: "El proyecto necesita al menos una persona responsable" });
    }
    await store.removeMember(projectId, userId);
    return c.body(null, 204);
  });

  app.post("/projects/:id/presence", async (c) => {
    const { projectId } = await allow(c, "read");
    const { activity } = await body(c, heartbeat);
    await store.touchPresence(projectId, c.get("user").id, activity);
    return c.json({ presence: await store.presence(projectId) });
  });

  app.get("/projects/:id/presence", async (c) => {
    const { projectId } = await allow(c, "read");
    return c.json({ presence: await store.presence(projectId) });
  });

  return app;
}
