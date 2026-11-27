import type { Role } from "./roles";
import type { Member, Presence, SharedProject, Tree, User } from "./store";

/** Error answered by the shared server, with its HTTP status. */
export class CollabError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "CollabError";
  }
}

export type CollabClientOptions = { url: string; token?: string | null; fetch?: typeof fetch };

/** Talks to a shared server (see createCollabServer). The token is sent only in the header. */
export function createCollabClient({ url, token, fetch: doFetch = fetch }: CollabClientOptions) {
  const base = `${url.replace(/\/+$/, "")}/api`;

  async function call<T>(method: string, path: string, payload?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        method,
        headers: { ...(payload !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: payload !== undefined ? JSON.stringify(payload) : undefined,
      });
    } catch {
      throw new CollabError("No se pudo conectar con el servidor compartido", 503);
    }
    if (res.status === 204) return undefined as T;
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new CollabError(typeof data.error === "string" ? data.error : `El servidor compartido respondió ${res.status}`, res.status, data);
    return data as T;
  }

  return {
    health: () => call<{ ok: boolean }>("GET", "/health"),
    register: (email: string, name: string, password: string) => call<{ user: User; token: string }>("POST", "/auth/register", { email, name, password }),
    login: (email: string, password: string) => call<{ user: User; token: string }>("POST", "/auth/login", { email, password }),
    logout: () => call<void>("POST", "/auth/logout"),
    me: () => call<{ user: User }>("GET", "/me"),
    projects: () => call<{ projects: (SharedProject & { role: Role })[] }>("GET", "/projects"),
    share: (id: string, name: string, tree: Tree) => call<{ revision: number; role: Role }>("POST", "/projects", { id, name, tree }),
    project: (id: string) => call<SharedProject & { tree: Tree; role: Role }>("GET", `/projects/${encodeURIComponent(id)}`),
    push: (id: string, baseRevision: number, name: string, tree: Tree) =>
      call<{ revision: number }>("PUT", `/projects/${encodeURIComponent(id)}/tree`, { baseRevision, name, tree }),
    members: (id: string) => call<{ members: Member[] }>("GET", `/projects/${encodeURIComponent(id)}/members`),
    setMember: (id: string, email: string, role: Role) => call<{ member: Member }>("PUT", `/projects/${encodeURIComponent(id)}/members`, { email, role }),
    removeMember: (id: string, userId: string) => call<void>("DELETE", `/projects/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`),
    heartbeat: (id: string, activity = "") => call<{ presence: Presence[] }>("POST", `/projects/${encodeURIComponent(id)}/presence`, { activity }),
    presence: (id: string) => call<{ presence: Presence[] }>("GET", `/projects/${encodeURIComponent(id)}/presence`),
  };
}

export type CollabClient = ReturnType<typeof createCollabClient>;
