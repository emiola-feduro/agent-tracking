import { PROJECT_KIND_INFO, type ProjectKind } from "./project-kind";

/**
 * How the code is organized, for the interface (frontend: web, mobile or desktop) and for the server
 * (backend). The wizard recommends one per layer from the kind of project and its stack, the person
 * can pick another, and the choice goes into CONTEXT.md so every agent follows the same structure.
 */
export type ArchitectureLayer = "frontend" | "backend";

export type ArchitectureOption = {
  id: string;
  label: string;
  /** What it is, in one sentence. */
  description: string;
  /** When it fits best. */
  when: string;
  /** How agents should place new code; goes into CONTEXT.md. */
  guidance: string;
};

export const FRONTEND_ARCHITECTURES: ArchitectureOption[] = [
  {
    id: "feature-based",
    label: "Por funcionalidades",
    description: "Cada funcionalidad tiene su carpeta con sus vistas, componentes, estado y llamadas a la API.",
    when: "La mayoría de apps web, móviles y de escritorio: crece sin que todo dependa de todo.",
    guidance: "Agrupa por funcionalidad (features/<nombre>/ con sus componentes, hooks, estado y API). Lo compartido va en una carpeta común; una funcionalidad no importa el interior de otra.",
  },
  {
    id: "layered-ui",
    label: "Por capas",
    description: "Carpetas por tipo: páginas, componentes, servicios, estado, utilidades.",
    when: "Apps pequeñas o equipos que empiezan: fácil de entender al principio.",
    guidance: "Separa por tipo: pages/ (o routes/), components/, services/ (API), stores/ (estado) y lib/. Los componentes no llaman a la API directo: lo hacen los servicios.",
  },
  {
    id: "atomic-design",
    label: "Atomic Design",
    description: "Componentes de interfaz en átomos, moléculas, organismos, plantillas y páginas.",
    when: "Interfaces con un sistema de diseño propio y muchos componentes reutilizables.",
    guidance: "Organiza la interfaz en atoms/, molecules/, organisms/, templates/ y pages/. Los átomos no conocen el negocio; la lógica de datos vive fuera de los componentes visuales.",
  },
  {
    id: "clean-ui",
    label: "Clean Architecture",
    description: "Presentación, dominio y datos separados, con el dominio sin depender de la interfaz ni de la API.",
    when: "Apps móviles o de escritorio con mucha lógica propia (Flutter, Kotlin, Swift) o que deben funcionar sin conexión.",
    guidance: "Separa presentation/ (vistas y su estado), domain/ (entidades y casos de uso, sin dependencias de UI ni red) y data/ (repositorios, API, almacenamiento local). La presentación solo habla con casos de uso.",
  },
  {
    id: "mvvm",
    label: "MVVM",
    description: "Cada vista tiene un ViewModel que expone su estado y acciones; el modelo no sabe de la vista.",
    when: "Apps nativas (SwiftUI, Jetpack Compose, .NET MAUI) y frameworks con enlace de datos.",
    guidance: "Cada pantalla tiene su ViewModel con el estado y las acciones; las vistas solo muestran y delegan. Los datos llegan por repositorios inyectados en el ViewModel.",
  },
  {
    id: "micro-frontends",
    label: "Micro-frontends",
    description: "La interfaz se divide en aplicaciones independientes que se componen en una sola.",
    when: "Varios equipos que publican partes de la interfaz por separado. Excesivo para un solo equipo.",
    guidance: "Cada micro-frontend es una app con su propio despliegue y contrato de integración (rutas, eventos o módulos federados). Comparten solo el sistema de diseño y la autenticación.",
  },
];

export const BACKEND_ARCHITECTURES: ArchitectureOption[] = [
  {
    id: "layered",
    label: "Por capas",
    description: "Rutas o controladores, servicios con la lógica y repositorios para los datos.",
    when: "APIs pequeñas o medianas y CRUDs: simple y conocida por todos.",
    guidance: "Las rutas/controladores validan la entrada y llaman a servicios; los servicios tienen la lógica de negocio; los repositorios son los únicos que tocan la base de datos.",
  },
  {
    id: "modular-monolith",
    label: "Monolito modular",
    description: "Una sola aplicación dividida en módulos por dominio, cada uno con sus capas y su API interna.",
    when: "La opción por defecto para un producto que va a crecer: orden sin la complejidad de los microservicios.",
    guidance: "Divide por dominio en modules/<dominio>/ con sus rutas, servicios y datos. Un módulo usa a otro solo por su API pública (un index o servicio exportado), nunca por sus tablas o archivos internos.",
  },
  {
    id: "hexagonal",
    label: "Hexagonal (puertos y adaptadores)",
    description: "El dominio en el centro define puertos; la base de datos, HTTP y servicios externos son adaptadores.",
    when: "Reglas de negocio importantes o integraciones que pueden cambiar (pagos, proveedores, bases de datos).",
    guidance: "El dominio (entidades y casos de uso) no importa frameworks ni la base de datos: define interfaces (puertos). HTTP, base de datos y servicios externos son adaptadores que implementan esos puertos.",
  },
  {
    id: "clean",
    label: "Clean Architecture",
    description: "Entidades, casos de uso, adaptadores de interfaz y frameworks en círculos que solo dependen hacia dentro.",
    when: "Dominios complejos y equipos que quieren el negocio aislado y fácil de probar.",
    guidance: "Respeta la regla de dependencias: entities/ y use-cases/ no conocen controllers/, gateways/ ni el framework. Cada caso de uso es una clase o función con su entrada y salida.",
  },
  {
    id: "microservices",
    label: "Microservicios",
    description: "Servicios pequeños e independientes, cada uno con su base de datos, que se comunican por red.",
    when: "Varios equipos, escalas distintas por parte o despliegues independientes. Mucho más costoso de operar.",
    guidance: "Cada servicio tiene su repositorio o carpeta, su base de datos y su contrato (HTTP o eventos) versionado. Nada de acceder a la base de otro servicio.",
  },
  {
    id: "serverless",
    label: "Serverless",
    description: "Funciones que se ejecutan bajo demanda en la nube, sin servidores que mantener.",
    when: "Cargas variables o por eventos, y equipos que no quieren operar servidores.",
    guidance: "Cada función hace una cosa y es sin estado; la lógica compartida va en librerías, no copiada. El estado vive en servicios gestionados (base de datos, colas, almacenamiento).",
  },
  {
    id: "event-driven",
    label: "Orientada a eventos (CQRS)",
    description: "Las escrituras emiten eventos y las lecturas usan modelos propios, separados de los de escritura.",
    when: "Flujos asíncronos, auditoría completa o lecturas y escrituras con necesidades muy distintas.",
    guidance: "Separa comandos (escriben y publican eventos) de consultas (leen modelos de lectura). Los manejadores de eventos son idempotentes y los eventos se nombran en pasado.",
  },
];

export const ARCHITECTURES: Record<ArchitectureLayer, ArchitectureOption[]> = { frontend: FRONTEND_ARCHITECTURES, backend: BACKEND_ARCHITECTURES };

export type ProjectArchitecture = { frontend?: string | null; backend?: string | null };

export const architectureOf = (layer: ArchitectureLayer, id: string | null | undefined) => (id ? ARCHITECTURES[layer].find((a) => a.id === id) ?? null : null);

/** Which layers apply: an interface, a server, or both (any piece counts in a monorepo). */
export function architectureLayers(kinds: ProjectKind[]): ArchitectureLayer[] {
  const info = kinds.map((k) => PROJECT_KIND_INFO[k]);
  return [...(info.some((i) => i.ui) ? (["frontend"] as const) : []), ...(info.some((i) => i.server) ? (["backend"] as const) : [])];
}

const has = (stack: string[], ...names: string[]) => names.some((n) => stack.some((s) => s.toLowerCase() === n.toLowerCase()));

/** The recommended architecture for a layer, with the reason in one sentence. */
export function recommendArchitecture(layer: ArchitectureLayer, ctx: { kinds: ProjectKind[]; stack: string[]; pieces?: number }): { id: string; reason: string } {
  const { kinds, stack } = ctx;
  if (layer === "frontend") {
    if (has(stack, "SwiftUI", "Jetpack Compose", ".NET MAUI", "WPF")) return { id: "mvvm", reason: "Es el patrón natural de las interfaces nativas que eligiste." };
    if (has(stack, "Flutter", "Kotlin Multiplatform") || (kinds.includes("mobile") && !kinds.includes("frontend"))) {
      return { id: "clean-ui", reason: "En apps móviles separar presentación, dominio y datos facilita probar y trabajar sin conexión." };
    }
    return { id: "feature-based", reason: "Agrupar por funcionalidad mantiene el código ordenado a medida que la app crece." };
  }
  if (has(stack, "AWS Lambda", "Cloudflare Workers", "Vercel Functions", "Firebase Functions")) return { id: "serverless", reason: "El stack que elegiste ejecuta funciones bajo demanda." };
  if (has(stack, "NestJS", "Spring Boot", "ASP.NET Core", "Django")) {
    return { id: "modular-monolith", reason: "El framework ya organiza el código en módulos: un monolito modular aprovecha esa estructura." };
  }
  if ((ctx.pieces ?? 0) > 2 || kinds.filter((k) => k === "api").length > 1) {
    return { id: "modular-monolith", reason: "Con varias piezas, módulos por dominio dan orden sin la complejidad de los microservicios." };
  }
  if (kinds.length === 1 && kinds[0] === "api") return { id: "layered", reason: "Para una API, rutas, servicios y repositorios separados son simples y suficientes." };
  return { id: "modular-monolith", reason: "Es la opción por defecto para un producto que va a crecer: módulos por dominio dentro de una sola aplicación." };
}

/** CONTEXT.md lines for the chosen architectures; empty when none was chosen. */
export function architectureMarkdown(chosen: ProjectArchitecture | null | undefined): string[] {
  const out: string[] = [];
  for (const layer of ["frontend", "backend"] as const) {
    const a = architectureOf(layer, chosen?.[layer]);
    if (a) out.push(`- **${layer === "frontend" ? "Frontend" : "Backend"}: ${a.label}.** ${a.guidance}`);
  }
  return out;
}
