import type { Attachment, RequirementArea, RequirementType } from "./types";

export const REQUIREMENT_TYPE_LABEL: Record<RequirementType, string> = {
  functional: "Funcional",
  non_functional: "No funcional",
};

export const REQUIREMENT_AREA_LABEL: Record<RequirementArea, string> = {
  general: "General",
  frontend: "Frontend",
  backend: "Backend",
  data: "Datos",
  infra: "Infraestructura",
  security: "Seguridad",
  performance: "Rendimiento",
  ux: "Experiencia de uso",
};

export const ATTACHMENTS_DIR = ".agent-tracking/attachments";

/** Where an image is exported in the repository, so agents can open it with their own tools. */
export const attachmentRepoPath = (a: Pick<Attachment, "id" | "filename">) => {
  const safe = a.filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "imagen";
  return `${ATTACHMENTS_DIR}/${a.id.slice(0, 8)}-${safe}`;
};

export const SHARED_SKILLS_DIR = ".agent-tracking/skills";

/** Folder of a skill copied into the repository so collaborators can install it. */
export const sharedSkillPath = (name: string) =>
  `${SHARED_SKILLS_DIR}/${name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "skill"}`;
