import type { ProjectKind } from "./project-kind";
import {
  FUNCTIONAL_AREAS,
  QUALITY_AREAS,
  REQUIREMENT_AREAS,
  REQUIREMENT_TYPES,
  type Attachment,
  type RequirementArea,
  type RequirementType,
} from "./types";

export const REQUIREMENT_TYPE_LABEL: Record<RequirementType, string> = {
  functional: "Funcional",
  non_functional: "No funcional",
};

/** One line each, shown next to the choice so the difference is obvious. */
export const REQUIREMENT_TYPE_HINT: Record<RequirementType, string> = {
  functional: "Algo que el sistema hace: una pantalla, un endpoint, un cálculo.",
  non_functional: "Qué tan bien lo hace: velocidad, seguridad, accesibilidad, disponibilidad.",
};

export const REQUIREMENT_AREA_LABEL: Record<RequirementArea, string> = {
  general: "General",
  frontend: "Frontend",
  backend: "Backend",
  data: "Datos",
  integration: "Integraciones",
  infra: "Infraestructura",
  performance: "Rendimiento",
  security: "Seguridad",
  ux: "Usabilidad",
  accessibility: "Accesibilidad",
  reliability: "Confiabilidad",
  scalability: "Escalabilidad",
  maintainability: "Mantenibilidad",
  compatibility: "Compatibilidad",
};

/** What the area means for each type: where it lives, or which quality it is about. */
export const AREA_GROUP_LABEL: Record<RequirementType, string> = {
  functional: "Parte del sistema",
  non_functional: "Atributo de calidad",
};

export const areasFor = (type: RequirementType): readonly RequirementArea[] => (type === "functional" ? FUNCTIONAL_AREAS : QUALITY_AREAS);
export const isAreaOf = (type: RequirementType, area: RequirementArea) => (areasFor(type) as readonly string[]).includes(area);

/** Words that point to a quality attribute (non functional), most specific first. */
const QUALITY_HINTS: [RequirementArea, RegExp][] = [
  ["accessibility", /accesib|wcag|lector de pantalla|screen reader|contraste|teclado|a11y|aria/],
  ["security", /\bsegur|cifr|encript|autentic|autoriz|permis|contrase|password|token|vulnerab|owasp|privacid|solo el (due|propietari)|rgpd|gdpr|\bjwt\b|https|xss|csrf|inyecci/],
  ["performance", /rendimiento|\bms\b|milisegundo|segundos?\b|\bp9[59]\b|latencia|tiempo de respuesta|r[aá]pid|velocidad|carga en menos|performance|throughput|lento/],
  ["scalability", /escala|escalab|concurren|usuarios simult|millones|horizontal|carga alta|\bk8s\b/],
  ["reliability", /disponib|uptime|99[.,]9|tolerant|recupera|respaldo|backup|reintent|sin p[eé]rdida|resilien|confiab|ca[ií]da/],
  ["compatibility", /compatib|navegador|chrome|safari|firefox|android \d|ios \d|versi[oó]n m[ií]nima|retrocompat/],
  ["maintainability", /mantenib|cobertura|coverage|lint|documentad|refactor|c[oó]digo limpio|modular|tipado estricto/],
  ["ux", /usabilidad|intuitiv|f[aá]cil de usar|experiencia de usuario|\bux\b|clics?|pasos para|aprend/],
];

/** Words that place a functional requirement in a part of the system. */
const PART_HINTS: [RequirementArea, RegExp][] = [
  ["integration", /integraci|webhook|stripe|paypal|github|slack|correo|email|e-mail|sms|notificaci[oó]n push|api externa|terceros|oauth con/],
  ["frontend", /pantalla|vista|p[aá]gina|bot[oó]n|formulario|modal|men[uú]|interfaz|\bui\b|dise[nñ]o|mostrar|visualiz|gr[aá]fic|tabla|filtro en la|dashboard|navegaci/],
  ["data", /base de datos|tabla de|migraci|esquema|[ií]ndice|consulta sql|\bsql\b|guardar en|persist|modelo de datos|reporte mensual|export|import/],
  ["backend", /\bapi\b|endpoint|\b(get|post|put|patch|delete)\b|servidor|backend|servicio|validaci|c[aá]lculo|calcular|procesa|registrar|crear|actualizar|eliminar|listar/],
  ["infra", /despliegue|deploy|docker|pipeline|\bci\b|kubernetes|servidor de producci|monitoreo|logs?\b|infraestructura/],
];

export type Classification = { type: RequirementType; area: RequirementArea; reason: string };

const norm = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Best guess of type and area from the text: quality words make it non functional, otherwise the
 * part of the system it touches. Projects without a UI never guess "frontend".
 */
export function classifyRequirement(title: string, description = "", kind: ProjectKind = "fullstack"): Classification {
  const text = norm(`${title} ${description}`);
  for (const [area, re] of QUALITY_HINTS) {
    const m = re.exec(text);
    if (m) return { type: "non_functional", area, reason: `menciona "${m[0].trim()}"` };
  }
  const noUi = kind === "api" || kind === "cli" || kind === "library";
  for (const [area, re] of PART_HINTS) {
    if (noUi && area === "frontend") continue;
    const m = re.exec(text);
    if (m) return { type: "functional", area, reason: `menciona "${m[0].trim()}"` };
  }
  if (kind === "api") return { type: "functional", area: "backend", reason: "el proyecto es una API" };
  if (kind === "frontend") return { type: "functional", area: "frontend", reason: "el proyecto es solo frontend" };
  return { type: "functional", area: "general", reason: "no hay pistas en el texto" };
}

/** Reads loose type and area words ("no funcional", "nfr", "seguridad", "backend") into the model. */
export function readClassification(words: string[]): { type?: RequirementType; area?: RequirementArea } {
  const out: { type?: RequirementType; area?: RequirementArea } = {};
  for (const raw of words) {
    const w = norm(raw.trim());
    if (!w) continue;
    if (/^(no[ -]?funcional|non[ _-]?functional|nfr|calidad)$/.test(w)) out.type = "non_functional";
    else if (/^(funcional|functional|fr)$/.test(w)) out.type = "functional";
    else if ((REQUIREMENT_TYPES as readonly string[]).includes(w)) out.type = w as RequirementType;
    else {
      const area = (REQUIREMENT_AREAS as readonly string[]).includes(w)
        ? (w as RequirementArea)
        : (Object.entries(REQUIREMENT_AREA_LABEL).find(([, label]) => norm(label) === w)?.[0] as RequirementArea | undefined) ??
          (w === "usabilidad" || w === "experiencia de uso" ? "ux" : undefined);
      if (area) out.area = area;
    }
  }
  return out;
}

/** Completes a partial classification: the missing half comes from the text, and they always agree. */
export function settleClassification(
  given: { type?: RequirementType; area?: RequirementArea },
  title: string,
  description = "",
  kind: ProjectKind = "fullstack",
): { type: RequirementType; area: RequirementArea } {
  const guess = classifyRequirement(title, description, kind);
  const type = given.type ?? (given.area ? ((QUALITY_AREAS as readonly string[]).includes(given.area) ? "non_functional" : "functional") : guess.type);
  const area = given.area && isAreaOf(type, given.area) ? given.area : guess.type === type ? guess.area : areasFor(type)[0]!;
  return { type, area };
}

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
