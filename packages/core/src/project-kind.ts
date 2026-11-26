import type { Platform } from "./types";
import { CATEGORY_PLATFORM, STACK_OPTIONS, type StackCategory, type StackOption } from "./stack";

/** What is being built, in broad terms. It decides which parts of the stack apply. */
export const PROJECT_KINDS = ["fullstack", "frontend", "api", "desktop", "mobile", "cli", "library"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

export type ProjectKindInfo = {
  label: string;
  description: string;
  /** Fixed platforms for this kind; null when the person chooses them. */
  platforms: Platform[] | null;
  /** Has a user interface. */
  ui: boolean;
  /** Has its own backend or server. */
  server: boolean;
  categories: StackCategory[];
};

export const PROJECT_KIND_INFO: Record<ProjectKind, ProjectKindInfo> = {
  fullstack: {
    label: "Aplicación completa",
    description: "Interfaz y backend propio: web, escritorio o móvil",
    platforms: null,
    ui: true,
    server: true,
    categories: ["frontend", "crossplatform", "desktop", "mobile", "backend", "language", "orm", "testing"],
  },
  frontend: {
    label: "Sitio o app web",
    description: "Solo frontend, sin backend propio",
    platforms: ["web"],
    ui: true,
    server: false,
    categories: ["frontend", "crossplatform", "language", "testing"],
  },
  api: {
    label: "API o servicio",
    description: "Backend sin interfaz: REST, GraphQL o workers",
    platforms: [],
    ui: false,
    server: true,
    categories: ["backend", "language", "orm", "testing"],
  },
  desktop: {
    label: "App de escritorio",
    description: "Corre local en Windows, macOS o Linux",
    platforms: ["desktop"],
    ui: true,
    server: false,
    categories: ["frontend", "crossplatform", "desktop", "language", "orm", "testing"],
  },
  mobile: {
    label: "App móvil",
    description: "iOS y Android, sin backend propio",
    platforms: ["mobile"],
    ui: true,
    server: false,
    categories: ["crossplatform", "mobile", "language", "orm", "testing"],
  },
  cli: {
    label: "Herramienta de terminal",
    description: "Un comando o script que se ejecuta en consola",
    platforms: [],
    ui: false,
    server: false,
    categories: ["language", "testing"],
  },
  library: {
    label: "Librería o paquete",
    description: "Código que usan otros proyectos",
    platforms: [],
    ui: false,
    server: false,
    categories: ["language", "testing"],
  },
};

export const isProjectKind = (value: unknown): value is ProjectKind => PROJECT_KINDS.includes(value as ProjectKind);

/** The platforms a project of this kind ends up with. */
export const kindPlatforms = (kind: ProjectKind, chosen: Platform[]): Platform[] => PROJECT_KIND_INFO[kind].platforms ?? chosen;

/**
 * Catalog options that apply to a kind of project on these platforms. Languages always apply;
 * kinds without platforms (APIs, CLIs, libraries) only get options that work everywhere.
 */
export function stackOptionsFor(kind: ProjectKind, chosenPlatforms: Platform[], options: StackOption[] = STACK_OPTIONS): StackOption[] {
  const { categories } = PROJECT_KIND_INFO[kind];
  const platforms = kindPlatforms(kind, chosenPlatforms);
  return options.filter((o) => {
    if (!categories.includes(o.category)) return false;
    if (o.category === "language") return true;
    const categoryPlatforms = CATEGORY_PLATFORM[o.category];
    if (categoryPlatforms && !categoryPlatforms.some((p) => platforms.includes(p))) return false;
    if (platforms.length === 0) return o.platforms.length === 3;
    return o.platforms.some((p) => platforms.includes(p));
  });
}
