/** Roles of a person in a shared project, from most to least power. */
export const ROLES = ["owner", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

/** What a member can do on the shared server. */
export type Action = "read" | "push" | "manageMembers" | "deleteProject";

const RANK: Record<Role, number> = { owner: 3, editor: 2, viewer: 1 };
const NEEDS: Record<Action, Role> = { read: "viewer", push: "editor", manageMembers: "owner", deleteProject: "owner" };

/** Whether `role` (or no membership) allows `action`. */
export const can = (role: Role | null | undefined, action: Action) => !!role && RANK[role] >= RANK[NEEDS[action]];

export const isRole = (value: unknown): value is Role => typeof value === "string" && (ROLES as readonly string[]).includes(value);

/** Spanish labels for the interface. */
export const ROLE_LABELS: Record<Role, string> = { owner: "Responsable", editor: "Edición", viewer: "Lectura" };
