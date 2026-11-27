import { SQL } from "bun";
import type { Role } from "./roles";

/**
 * Storage of the shared server. Runs on PostgreSQL in production (DATABASE_URL=postgres://...) and
 * on SQLite in tests or small installs: the SQL below is the subset both understand.
 */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS collab_users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS collab_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES collab_users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS collab_projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tree TEXT NOT NULL,
    revision INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS collab_members (
    project_id TEXT NOT NULL REFERENCES collab_projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES collab_users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    PRIMARY KEY (project_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS collab_presence (
    project_id TEXT NOT NULL REFERENCES collab_projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES collab_users(id) ON DELETE CASCADE,
    activity TEXT NOT NULL,
    seen_at TEXT NOT NULL,
    PRIMARY KEY (project_id, user_id)
  )`,
];

export type User = { id: string; email: string; name: string };
export type Member = User & { role: Role };
export type SharedProject = { id: string; name: string; revision: number; updatedAt: string; updatedBy: string };
/** The project's shareable files (`.agent-tracking` tree): path to JSON text. */
export type Tree = Record<string, string>;
export type Presence = { userId: string; name: string; activity: string; seenAt: string };

/** How long a heartbeat keeps someone shown as present. */
export const PRESENCE_TTL_MS = 60_000;

const now = () => new Date().toISOString();
const sha256 = (text: string) => new Bun.CryptoHasher("sha256").update(text).digest("hex");
const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Bun.SQL reads a bare path as a PostgreSQL address; anything that is not postgres:// is a SQLite
 * file here (or ":memory:").
 */
export const storeUrl = (url: string) =>
  /^(postgres(ql)?|sqlite|file):/i.test(url) || url === ":memory:" ? url : `sqlite://${url}`;

export type CollabStore = Awaited<ReturnType<typeof openCollabStore>>;

/** Opens the store at `url` (postgres://..., or a SQLite path / ":memory:") and creates its tables. */
export async function openCollabStore(url = process.env.DATABASE_URL ?? ":memory:") {
  const sql = new SQL(storeUrl(url));
  if ((sql.options as { adapter?: string }).adapter === "sqlite") await sql.unsafe("PRAGMA foreign_keys = ON");
  for (const stmt of SCHEMA) await sql.unsafe(stmt);

  async function userByEmail(email: string) {
    const [row] = await sql`SELECT id, email, name, password_hash FROM collab_users WHERE email = ${normalizeEmail(email)}`;
    return row as { id: string; email: string; name: string; password_hash: string } | undefined;
  }

  async function newSession(userId: string) {
    const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
    await sql`INSERT INTO collab_sessions (token_hash, user_id, created_at) VALUES (${sha256(token)}, ${userId}, ${now()})`;
    return token;
  }

  return {
    close: () => sql.close(),

    /** Creates an account and returns a session token. Null when the email is taken. */
    async register(email: string, name: string, password: string): Promise<{ user: User; token: string } | null> {
      if (await userByEmail(email)) return null;
      const user = { id: crypto.randomUUID(), email: normalizeEmail(email), name: name.trim() };
      const hash = await Bun.password.hash(password);
      await sql`INSERT INTO collab_users (id, email, name, password_hash, created_at) VALUES (${user.id}, ${user.email}, ${user.name}, ${hash}, ${now()})`;
      return { user, token: await newSession(user.id) };
    },

    /** Checks the password and returns a new session token, or null. */
    async login(email: string, password: string): Promise<{ user: User; token: string } | null> {
      const row = await userByEmail(email);
      if (!row || !(await Bun.password.verify(password, row.password_hash))) return null;
      return { user: { id: row.id, email: row.email, name: row.name }, token: await newSession(row.id) };
    },

    async logout(token: string) {
      await sql`DELETE FROM collab_sessions WHERE token_hash = ${sha256(token)}`;
    },

    /** The user a session token belongs to. Only the token's hash is stored. */
    async userByToken(token: string): Promise<User | null> {
      const [row] = await sql`
        SELECT u.id, u.email, u.name FROM collab_sessions s JOIN collab_users u ON u.id = s.user_id
        WHERE s.token_hash = ${sha256(token)}`;
      return (row as User | undefined) ?? null;
    },

    async roleOf(projectId: string, userId: string): Promise<Role | null> {
      const [row] = await sql`SELECT role FROM collab_members WHERE project_id = ${projectId} AND user_id = ${userId}`;
      return (row?.role as Role | undefined) ?? null;
    },

    async project(projectId: string): Promise<(SharedProject & { tree: Tree }) | null> {
      const [row] = await sql`SELECT id, name, tree, revision, updated_at, updated_by FROM collab_projects WHERE id = ${projectId}`;
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        revision: Number(row.revision),
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
        tree: JSON.parse(row.tree) as Tree,
      };
    },

    /** Projects the user is a member of, with their role. */
    async projectsOf(userId: string): Promise<(SharedProject & { role: Role })[]> {
      const rows = await sql`
        SELECT p.id, p.name, p.revision, p.updated_at, p.updated_by, m.role
        FROM collab_members m JOIN collab_projects p ON p.id = m.project_id
        WHERE m.user_id = ${userId} ORDER BY p.name`;
      return rows.map((r: Record<string, string>) => ({
        id: r.id!,
        name: r.name!,
        revision: Number(r.revision),
        updatedAt: r.updated_at!,
        updatedBy: r.updated_by!,
        role: r.role as Role,
      }));
    },

    /** Shares a project for the first time; its creator becomes the owner. False when the id exists. */
    async createProject(id: string, name: string, tree: Tree, userId: string): Promise<boolean> {
      return sql.begin(async (tx) => {
        const [taken] = await tx`SELECT id FROM collab_projects WHERE id = ${id}`;
        if (taken) return false;
        await tx`INSERT INTO collab_projects (id, name, tree, revision, updated_at, updated_by)
          VALUES (${id}, ${name}, ${JSON.stringify(tree)}, ${1}, ${now()}, ${userId})`;
        await tx`INSERT INTO collab_members (project_id, user_id, role) VALUES (${id}, ${userId}, ${"owner"})`;
        return true;
      });
    },

    /**
     * Saves a new version only if nobody pushed since `baseRevision` (optimistic locking). Returns
     * the new revision, or null when the client has to pull and merge first.
     */
    async pushTree(projectId: string, baseRevision: number, tree: Tree, name: string, userId: string): Promise<number | null> {
      const rows = await sql`
        UPDATE collab_projects SET tree = ${JSON.stringify(tree)}, name = ${name}, revision = revision + 1, updated_at = ${now()}, updated_by = ${userId}
        WHERE id = ${projectId} AND revision = ${baseRevision} RETURNING revision`;
      return rows.length ? Number(rows[0].revision) : null;
    },

    async deleteProject(projectId: string) {
      await sql`DELETE FROM collab_projects WHERE id = ${projectId}`;
    },

    async members(projectId: string): Promise<Member[]> {
      const rows = await sql`
        SELECT u.id, u.email, u.name, m.role FROM collab_members m JOIN collab_users u ON u.id = m.user_id
        WHERE m.project_id = ${projectId} ORDER BY u.name`;
      return [...rows] as Member[];
    },

    /** Adds a registered person to the project or changes their role. Null when the email is unknown. */
    async setMember(projectId: string, email: string, role: Role): Promise<Member | null> {
      const user = await userByEmail(email);
      if (!user) return null;
      await sql`INSERT INTO collab_members (project_id, user_id, role) VALUES (${projectId}, ${user.id}, ${role})
        ON CONFLICT (project_id, user_id) DO UPDATE SET role = excluded.role`;
      return { id: user.id, email: user.email, name: user.name, role };
    },

    async removeMember(projectId: string, userId: string) {
      await sql`DELETE FROM collab_members WHERE project_id = ${projectId} AND user_id = ${userId}`;
      await sql`DELETE FROM collab_presence WHERE project_id = ${projectId} AND user_id = ${userId}`;
    },

    async ownerCount(projectId: string): Promise<number> {
      const [row] = await sql`SELECT COUNT(*) AS n FROM collab_members WHERE project_id = ${projectId} AND role = ${"owner"}`;
      return Number(row.n);
    },

    /** Records that the user is working on the project right now (a heartbeat). */
    async touchPresence(projectId: string, userId: string, activity: string) {
      await sql`INSERT INTO collab_presence (project_id, user_id, activity, seen_at) VALUES (${projectId}, ${userId}, ${activity}, ${now()})
        ON CONFLICT (project_id, user_id) DO UPDATE SET activity = excluded.activity, seen_at = excluded.seen_at`;
    },

    /** Members seen in the last PRESENCE_TTL_MS. */
    async presence(projectId: string, at = Date.now()): Promise<Presence[]> {
      const since = new Date(at - PRESENCE_TTL_MS).toISOString();
      const rows = await sql`
        SELECT p.user_id, u.name, p.activity, p.seen_at FROM collab_presence p JOIN collab_users u ON u.id = p.user_id
        WHERE p.project_id = ${projectId} AND p.seen_at >= ${since} ORDER BY u.name`;
      return rows.map((r: Record<string, string>) => ({ userId: r.user_id!, name: r.name!, activity: r.activity!, seenAt: r.seen_at! }));
    },
  };
}
