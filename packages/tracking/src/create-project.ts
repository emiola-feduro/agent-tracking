import {
  githubFiles,
  kindPlatforms,
  settleClassification,
  type CommitConventions,
  type GithubFileKind,
  type Platform,
  type ProjectKind,
  type RequirementArea,
  type RequirementType,
  type SkillSource,
} from "@agent-tracking/core";
import { schema as s, type Db } from "@agent-tracking/db";
import { inspectRepo, writeNewFiles } from "@agent-tracking/git";
import { eq } from "drizzle-orm";
import { writeRepoFiles } from "./repo-sync";
import { TrackingError, type Emit } from "./tracker";

export type NewProjectRequirement = {
  title: string;
  description?: string;
  /** Inferred from the text when missing (see settleClassification). */
  type?: RequirementType;
  area?: RequirementArea;
  weight?: number;
  dod?: { criterion: string; origin?: "human" | "llm" }[];
};

export type NewProjectInput = {
  name: string;
  goal?: string;
  kind: ProjectKind;
  platforms?: Platform[];
  stack?: string[];
  databases?: string[];
  repoPath?: string | null;
  repoUrl?: string | null;
  rules?: string[];
  skills?: { name: string; description: string; source: SkillSource; location: string; enabled?: boolean; [extra: string]: unknown }[];
  requirements?: NewProjectRequirement[];
  githubFiles?: GithubFileKind[];
  prTemplate?: string;
  commitConventions?: CommitConventions | null;
  agents?: string[];
};

/**
 * Creates a project with everything the wizard collects, writes its files into the repository and
 * tells live clients. Shared by the HTTP API (the wizard) and the MCP tool that builds one from a plan.
 */
export async function createProject(db: Db, emit: Emit, input: NewProjectInput, actor = "user:local"): Promise<string> {
  const kind = input.kind;
  const platforms = kindPlatforms(kind, input.platforms ?? []);
  let repoPath = input.repoPath?.trim() || null;
  let repoUrl = input.repoUrl ?? null;
  if (repoPath) {
    const repo = await inspectRepo(repoPath);
    if (!repo) throw new TrackingError("La ruta no es un repositorio git (debe ser absoluta)");
    const [existing] = await db.select({ id: s.projects.id }).from(s.projects).where(eq(s.projects.repoPath, repo.root)).limit(1);
    if (existing) throw new TrackingError(`Este repositorio ya está en Agent Tracking (proyecto ${existing.id})`, 409);
    repoPath = repo.root;
    repoUrl ??= repo.remoteUrl;
  }
  const id = crypto.randomUUID();
  const audit = { createdBy: actor, updatedBy: actor };
  const requirements = (input.requirements ?? []).map((r) => ({
    ...r,
    description: r.description ?? "",
    ...settleClassification({ type: r.type, area: r.area }, r.title, r.description ?? "", kind),
  }));
  db.transaction((tx) => {
    tx.insert(s.projects)
      .values({
        id,
        name: input.name.trim(),
        goal: input.goal?.trim() ?? "",
        kind,
        commitConventions: input.commitConventions ?? null,
        agents: input.agents ?? [],
        platforms,
        stack: input.stack ?? [],
        databases: input.databases ?? [],
        repoPath,
        repoUrl,
        ...audit,
      })
      .run();
    (input.rules ?? []).forEach((text, i) => tx.insert(s.businessRules).values({ id: crypto.randomUUID(), projectId: id, text, priority: i + 1, ...audit }).run());
    for (const k of input.skills ?? []) tx.insert(s.projectSkills).values({ id: crypto.randomUUID(), projectId: id, ...k, ...audit } as never).run();
    for (const { dod = [], title, description, type, area, weight } of requirements) {
      const requirementId = crypto.randomUUID();
      tx.insert(s.requirements).values({ id: requirementId, projectId: id, title, description, type, area, weight: weight ?? 1, ...audit }).run();
      for (const d of dod) {
        tx.insert(s.dodItems).values({ id: crypto.randomUUID(), requirementId, criterion: d.criterion, origin: d.origin ?? "human", ...audit }).run();
      }
    }
  });
  await writeRepoFiles(db, id);
  const kinds = input.githubFiles ?? [];
  if (repoPath && kinds.length > 0) {
    const files = githubFiles({ name: input.name, stack: input.stack ?? [], requirements }, kinds).map((f) =>
      f.kind === "prTemplate" && input.prTemplate?.trim() ? { ...f, content: `${input.prTemplate.trimEnd()}\n` } : f,
    );
    await writeNewFiles(repoPath, files);
  }
  emit({ type: "project.created", projectId: id });
  return id;
}
