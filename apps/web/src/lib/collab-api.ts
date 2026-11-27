import { request } from "./api";

/** Roles in a shared project (see packages/collab). */
export type CollabRole = "owner" | "editor" | "viewer";
export const COLLAB_ROLES: { value: CollabRole; label: string; hint: string }[] = [
  { value: "owner", label: "Responsable", hint: "Edita y decide quién participa" },
  { value: "editor", label: "Edición", hint: "Sincroniza sus cambios" },
  { value: "viewer", label: "Lectura", hint: "Solo recibe cambios" },
];
export const roleLabel = (role: CollabRole) => COLLAB_ROLES.find((r) => r.value === role)?.label ?? role;

export type CollabUser = { id: string; email: string; name: string };
export type CollabConnection = { connected: boolean; url: string | null; user: CollabUser | null };
export type CollabMember = CollabUser & { role: CollabRole };
export type CollabPresence = { userId: string; name: string; activity: string; seenAt: string };
export type SharedProjectItem = { id: string; name: string; revision: number; updatedAt: string; role: CollabRole };
export type CollabProjectStatus = {
  connected: boolean;
  shared: boolean;
  role: CollabRole | null;
  revision: number | null;
  syncedRevision: number | null;
  updatedAt?: string;
};
export type CollabSyncResult = { revision: number; role: CollabRole; pulled: boolean; pushed: boolean };

const p = (id: string) => `/projects/${encodeURIComponent(id)}/collab`;

export const collabApi = {
  connection: () => request<CollabConnection>("GET", "/collab"),
  connect: (data: { url: string; email: string; password: string; name?: string }) => request<CollabConnection>("POST", "/collab/connect", data),
  disconnect: () => request<void>("DELETE", "/collab"),
  sharedProjects: () => request<{ projects: SharedProjectItem[] }>("GET", "/collab/projects"),
  join: (projectId: string, repoPath: string) => request<CollabSyncResult>("POST", "/collab/join", { projectId, repoPath }),
  status: (id: string) => request<CollabProjectStatus>("GET", p(id)),
  share: (id: string) => request<CollabSyncResult>("POST", `${p(id)}/share`),
  sync: (id: string) => request<CollabSyncResult>("POST", `${p(id)}/sync`),
  members: (id: string) => request<{ members: CollabMember[] }>("GET", `${p(id)}/members`),
  setMember: (id: string, email: string, role: CollabRole) => request<{ member: CollabMember }>("PUT", `${p(id)}/members`, { email, role }),
  removeMember: (id: string, userId: string) => request<void>("DELETE", `${p(id)}/members/${encodeURIComponent(userId)}`),
  heartbeat: (id: string, activity = "") => request<{ presence: CollabPresence[] }>("POST", `${p(id)}/presence`, { activity }),
};
