import type { ProjectSnapshot } from "@agent-tracking/core";
import { eq, inArray } from "drizzle-orm";
import type { Db } from "./index";
import {
  businessRules,
  dodItems,
  featureFiles,
  features,
  fileArtifacts,
  projectSkills,
  projects,
  requirements,
  symbols,
  testIdeas,
  tests,
} from "./schema";

/** Carga todo lo de un proyecto en la forma que usa `@agent-tracking/core`. */
export async function loadSnapshot(db: Db, projectId: string): Promise<ProjectSnapshot | null> {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return null;
  const [rules, skills, reqs, projectTests, files, ideas] = await Promise.all([
    db.select().from(businessRules).where(eq(businessRules.projectId, projectId)),
    db.select().from(projectSkills).where(eq(projectSkills.projectId, projectId)),
    db.select().from(requirements).where(eq(requirements.projectId, projectId)).orderBy(requirements.createdAt),
    db.select().from(tests).where(eq(tests.projectId, projectId)),
    db.select().from(fileArtifacts).where(eq(fileArtifacts.projectId, projectId)).orderBy(fileArtifacts.path),
    db.select().from(testIdeas).where(eq(testIdeas.projectId, projectId)).orderBy(testIdeas.createdAt),
  ]);
  const reqIds = reqs.map((r) => r.id);
  const fileIds = files.map((f) => f.id);
  const [dod, feats] = reqIds.length
    ? await Promise.all([
        db.select().from(dodItems).where(inArray(dodItems.requirementId, reqIds)).orderBy(dodItems.createdAt),
        db.select().from(features).where(inArray(features.requirementId, reqIds)).orderBy(features.createdAt),
      ])
    : [[], []];
  const [links, syms] = fileIds.length
    ? await Promise.all([
        db
          .select({ featureId: featureFiles.featureId, fileId: featureFiles.fileId })
          .from(featureFiles)
          .where(inArray(featureFiles.fileId, fileIds)),
        db.select().from(symbols).where(inArray(symbols.fileId, fileIds)).orderBy(symbols.lineStart, symbols.name),
      ])
    : [[], []];
  return {
    project,
    rules,
    skills,
    requirements: reqs,
    dod,
    features: feats,
    tests: projectTests,
    files,
    featureFiles: links,
    symbols: syms,
    testIdeas: ideas,
  };
}
