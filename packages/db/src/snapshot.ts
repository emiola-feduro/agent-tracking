import type { ProjectSnapshot } from "@agent-tracking/core";
import { eq, inArray } from "drizzle-orm";
import type { Db } from "./index";
import { businessRules, dodItems, features, projectSkills, projects, requirements, tests } from "./schema";

/** Carga todo lo de un proyecto en la forma que usa `@agent-tracking/core`. */
export async function loadSnapshot(db: Db, projectId: string): Promise<ProjectSnapshot | null> {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return null;
  const [rules, skills, reqs, projectTests] = await Promise.all([
    db.select().from(businessRules).where(eq(businessRules.projectId, projectId)),
    db.select().from(projectSkills).where(eq(projectSkills.projectId, projectId)),
    db.select().from(requirements).where(eq(requirements.projectId, projectId)).orderBy(requirements.createdAt),
    db.select().from(tests).where(eq(tests.projectId, projectId)),
  ]);
  const reqIds = reqs.map((r) => r.id);
  const [dod, feats] = reqIds.length
    ? await Promise.all([
        db.select().from(dodItems).where(inArray(dodItems.requirementId, reqIds)).orderBy(dodItems.createdAt),
        db.select().from(features).where(inArray(features.requirementId, reqIds)).orderBy(features.createdAt),
      ])
    : [[], []];
  return { project, rules, skills, requirements: reqs, dod, features: feats, tests: projectTests };
}
