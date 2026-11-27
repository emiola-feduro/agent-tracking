import {
  githubFiles,
  scaffoldFiles,
  type ProjectPart,
  type ProjectStructure,
  type TestType,
  kindPlatforms,
  settleClassification,
  type CommitConventions,
  type GithubFileKind,
  type Platform,
  type ProjectKind,
  type RequirementArea,
  type RequirementType,
  type SkillSource,
  assignRequirementCodes,
  DEFAULT_REPLY_LANGUAGE,
  type ReplyLanguage,
  type ProjectArchitecture,
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
  /** Ids of the pieces it touches (monorepos). */
  parts?: string[];
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
  structure?: ProjectStructure;
  parts?: ProjectPart[];
  monorepoTool?: string | null;
  testTypes?: TestType[];
  replyLanguage?: ReplyLanguage | null;
  architecture?: ProjectArchitecture;
  /** Write the starting folders, READMEs and manifests (see scaffoldFiles); existing files stay. */
  scaffold?: boolean;
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
        structure: input.structure ?? "single",
        parts: input.structure === "monorepo" ? (input.parts ?? []) : [],
        monorepoTool: input.structure === "monorepo" ? (input.monorepoTool ?? null) : null,
        testTypes: input.testTypes ?? [],
        replyLanguage: input.replyLanguage === undefined ? DEFAULT_REPLY_LANGUAGE : input.replyLanguage,
        architecture: input.architecture ?? {},
        ...audit,
      })
      .run();
    (input.rules ?? []).forEach((text, i) => tx.insert(s.businessRules).values({ id: crypto.randomUUID(), projectId: id, text, priority: i + 1, ...audit }).run());
    for (const k of input.skills ?? []) tx.insert(s.projectSkills).values({ id: crypto.randomUUID(), projectId: id, ...k, ...audit } as never).run();
    const partIds = new Set((input.parts ?? []).map((p) => p.id));
    for (const { dod = [], title, description, type, area, weight, parts, code } of assignRequirementCodes(requirements)) {
      const requirementId = crypto.randomUUID();
      const touched = (parts ?? []).filter((p) => partIds.has(p));
      tx.insert(s.requirements).values({ id: requirementId, projectId: id, code, title, description, type, area, weight: weight ?? 1, parts: touched, ...audit }).run();
      for (const d of dod) {
        tx.insert(s.dodItems).values({ id: crypto.randomUUID(), requirementId, criterion: d.criterion, origin: d.origin ?? "human", ...audit }).run();
      }
    }
  });
  await writeRepoFiles(db, id);
  if (repoPath && input.scaffold) {
    const structure = input.structure ?? "single";
    const parts: ProjectPart[] =
      structure === "monorepo"
        ? (input.parts ?? [])
        : [{ id: "root", name: input.name, kind, platforms, path: ".", stack: input.stack ?? [] }];
    await writeNewFiles(repoPath, scaffoldFiles({ name: input.name, structure, parts, tool: input.monorepoTool ?? null }));
  }
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
