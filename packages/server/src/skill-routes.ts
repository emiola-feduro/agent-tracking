import { schema as s, type Db } from "@agent-tracking/db";
import {
  discoverSkills,
  installSharedSkill,
  pluginInstallCommands,
  runInstallCommands,
  skillOrigin,
} from "@agent-tracking/skills";
import type { Tracker } from "@agent-tracking/tracking";
import { sharedSkillPath } from "@agent-tracking/core";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { join } from "node:path";
import { z } from "zod";

type SkillRow = typeof s.projectSkills.$inferSelect;

/** How a project skill can be had on this machine. */
export type SkillAvailability = {
  skillId: string;
  installed: boolean;
  /** shared: copied from the repo into ~/.claude/skills. plugin: installed with the Claude Code CLI. */
  install: "shared" | "plugin" | null;
  /** The plugin commands, to show or to run by hand. */
  commands: string[] | null;
};

/**
 * Skills that travel with a project:
 *
 *   GET   /projects/:id/skills/status                → SkillAvailability[] for this machine
 *   POST  /projects/:id/skills/:skillId/install      → installs it (shared copy or plugin)
 *   PATCH /projects/:id/skills/:skillId { shared }   → copy it into the repo for collaborators (in app.ts)
 */
export function skillRoutes(db: Db, tracker: Tracker, opts: { claudeHome: string }) {
  const { claudeHome } = opts;
  const app = new Hono();

  /** Fills in plugin and marketplace for skills added before that was recorded. */
  const withOrigin = async (rows: SkillRow[]) => {
    for (const row of rows) {
      if (row.plugin || (row.source !== "plugin" && row.source !== "catalog")) continue;
      const origin = await skillOrigin(row.location, claudeHome);
      if (!origin.plugin) continue;
      await db.update(s.projectSkills).set(origin).where(eq(s.projectSkills.id, row.id));
      Object.assign(row, origin);
    }
    return rows;
  };

  const availability = async (projectId: string): Promise<SkillAvailability[]> => {
    const project = await tracker.projectOr404(projectId);
    const rows = await withOrigin(await db.select().from(s.projectSkills).where(eq(s.projectSkills.projectId, projectId)));
    const here = await discoverSkills({ claudeHome, repoPath: project.repoPath });
    const plugins = await installedPlugins(claudeHome);
    return Promise.all(
      rows.map(async (row) => {
        // Installed when its file is here, its plugin is installed, or a skill with that name was found.
        const installed =
          (row.plugin && row.marketplace ? plugins.has(`${row.plugin}@${row.marketplace}`) : false) ||
          (!!row.location && (await Bun.file(row.location).exists())) ||
          here.some((k) => k.name === row.name && (!row.plugin || k.plugin === row.plugin));
        const sharedHere = !!project.repoPath && row.shared && (await Bun.file(join(project.repoPath, sharedSkillPath(row.name), "SKILL.md")).exists());
        const steps = row.plugin ? await pluginInstallCommands(row, claudeHome) : null;
        return {
          skillId: row.id,
          installed,
          install: installed ? null : sharedHere ? "shared" : steps ? "plugin" : null,
          commands: steps?.map((argv) => argv.join(" ")) ?? null,
        };
      }),
    );
  };

  app.get("/projects/:id/skills/status", async (c) => c.json(await availability(c.req.param("id"))));

  app.post("/projects/:id/skills/:skillId/install", async (c) => {
    const { id: projectId, skillId } = c.req.param();
    const project = await tracker.projectOr404(projectId);
    const row = await db.query.projectSkills.findFirst({ where: and(eq(s.projectSkills.id, skillId), eq(s.projectSkills.projectId, projectId)) });
    if (!row) throw new HTTPException(404, { message: "Skill no encontrada" });
    const status = (await availability(projectId)).find((a) => a.skillId === skillId)!;
    if (status.installed) return c.json(status);
    try {
      if (status.install === "shared") {
        const location = await installSharedSkill(project.repoPath!, row.name, claudeHome);
        await db.update(s.projectSkills).set({ location }).where(eq(s.projectSkills.id, skillId));
      } else if (status.install === "plugin") {
        await runInstallCommands((await pluginInstallCommands(row, claudeHome))!);
      } else {
        throw new HTTPException(400, { message: "Esta skill no se puede instalar desde aquí: pídela a quien la agregó al proyecto" });
      }
    } catch (e) {
      if (e instanceof HTTPException) throw e;
      throw new HTTPException(400, { message: (e as Error).message });
    }
    await tracker.touch(projectId, "skill", skillId);
    return c.json((await availability(projectId)).find((a) => a.skillId === skillId));
  });

  return app;
}

/** Ids ("plugin@marketplace") of the plugins Claude Code has installed. */
async function installedPlugins(claudeHome: string): Promise<Set<string>> {
  const data = await Bun.file(join(claudeHome, "plugins", "installed_plugins.json")).json().catch(() => null);
  return new Set(Object.keys((data as { plugins?: object } | null)?.plugins ?? {}));
}

/** Plugin and marketplace for new skills, so the project file says where to get them. */
export async function originFor(skill: { source: string; location: string }, claudeHome: string) {
  if (skill.source !== "plugin" && skill.source !== "catalog") return {};
  return skillOrigin(skill.location, claudeHome);
}

export const sharedPatch = z.object({ enabled: z.boolean(), shared: z.boolean() }).partial();
