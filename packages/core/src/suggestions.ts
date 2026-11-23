import { DATABASE_KIND_LABEL, DATABASE_SUGGESTIONS, STACK_OPTIONS, type DatabaseOption } from "./stack";
import type { Platform } from "./types";

/** An entry offered by autocomplete. */
export type Suggestion<K extends string = string> = {
  name: string;
  kind: K;
  platforms: Platform[];
  aliases?: string[];
  /** Only suggested up front when the stack has one of these (always found by search). */
  relevantWith?: string[];
};

export type SuggestContext = {
  platforms: Platform[];
  /** Current selection, used for relevance and to hide what is already chosen. */
  selected: string[];
  /** Extra names to hide, for example the stack when suggesting technologies. */
  exclude?: string[];
  limit?: number;
};

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Ranks catalog entries for a query: prefix of name or alias first, then word prefix, then
 * substring, then kind. An empty query suggests entries for the chosen platforms and stack.
 */
export function suggestFrom<K extends string>(
  catalog: Suggestion<K>[],
  kindLabel: Record<K, string>,
  query: string,
  { platforms, selected, exclude = [], limit = 8 }: SuggestContext,
): Suggestion<K>[] {
  const q = normalize(query);
  const taken = new Set([...selected, ...exclude].map(normalize));
  const pool = catalog.filter((d) => !taken.has(normalize(d.name)));

  if (!q) {
    const chosen = new Set(selected.map(normalize));
    return pool
      .filter((d) => d.platforms.some((p) => platforms.includes(p)))
      .filter((d) => !d.relevantWith || d.relevantWith.some((r) => chosen.has(normalize(r))))
      // Entries tied to the current stack come first.
      .sort((a, b) => Number(!!b.relevantWith) - Number(!!a.relevantWith))
      .slice(0, limit);
  }

  const score = (d: Suggestion<K>) => {
    const terms = [d.name, ...(d.aliases ?? [])].map(normalize);
    if (terms.some((t) => t.startsWith(q))) return 0;
    if (terms.some((t) => t.split(/[\s./-]+/).some((w) => w.startsWith(q)))) return 1;
    if (terms.some((t) => t.includes(q))) return 2;
    if (normalize(kindLabel[d.kind]).startsWith(q)) return 3;
    return -1;
  };
  return pool
    .map((d) => ({ d, s: score(d) }))
    .filter(({ s }) => s >= 0)
    .sort((a, b) => a.s - b.s)
    .slice(0, limit)
    .map(({ d }) => d);
}

/** Autocomplete for "Otras bases de datos". */
export function suggestDatabases(query: string, platforms: Platform[], selected: string[] = [], limit = 8): DatabaseOption[] {
  return suggestFrom(DATABASE_SUGGESTIONS, DATABASE_KIND_LABEL, query, { platforms, selected, limit }) as DatabaseOption[];
}

export type TechKind =
  | "api"
  | "state"
  | "ui"
  | "forms"
  | "auth"
  | "payments"
  | "realtime"
  | "messaging"
  | "email"
  | "notifications"
  | "ai"
  | "maps"
  | "charts"
  | "i18n"
  | "navigation"
  | "infra"
  | "deploy"
  | "observability"
  | "tooling";

export const TECH_KIND_LABEL: Record<TechKind, string> = {
  api: "API",
  state: "Estado",
  ui: "Componentes UI",
  forms: "Formularios y validación",
  auth: "Autenticación",
  payments: "Pagos",
  realtime: "Tiempo real",
  messaging: "Colas y eventos",
  email: "Correo",
  notifications: "Notificaciones",
  ai: "IA",
  maps: "Mapas",
  charts: "Gráficos",
  i18n: "Traducciones",
  navigation: "Navegación",
  infra: "Infraestructura",
  deploy: "Despliegue",
  observability: "Observabilidad",
  tooling: "Herramientas",
};

const all: Platform[] = ["web", "desktop", "mobile"];
const REACT = ["React", "Next.js", "React Native", "Expo"];
const REACT_WEB = ["React", "Next.js"];

/** Offered by autocomplete under "Otras tecnologías". Names in STACK_OPTIONS are left out. */
export const TECH_SUGGESTIONS: Suggestion<TechKind>[] = [
  { name: "GraphQL", kind: "api", platforms: all },
  { name: "Apollo", kind: "api", platforms: all, aliases: ["apollo client", "apollo server", "graphql"] },
  { name: "tRPC", kind: "api", platforms: all, relevantWith: ["TypeScript"] },
  { name: "OpenAPI", kind: "api", platforms: all, aliases: ["swagger"] },
  { name: "gRPC", kind: "api", platforms: all, aliases: ["protobuf"] },
  { name: "Zod", kind: "forms", platforms: all, aliases: ["validacion", "schema"], relevantWith: ["TypeScript"] },
  { name: "Valibot", kind: "forms", platforms: all, relevantWith: ["TypeScript"] },
  { name: "React Hook Form", kind: "forms", platforms: all, aliases: ["formularios"], relevantWith: REACT },
  { name: "TanStack Query", kind: "state", platforms: all, aliases: ["react query"], relevantWith: REACT },
  { name: "TanStack Router", kind: "navigation", platforms: ["web", "desktop"], relevantWith: ["React"] },
  { name: "React Router", kind: "navigation", platforms: ["web", "desktop"], relevantWith: ["React"] },
  { name: "Zustand", kind: "state", platforms: all, relevantWith: REACT },
  { name: "Redux Toolkit", kind: "state", platforms: all, aliases: ["redux", "rtk"], relevantWith: REACT },
  { name: "Jotai", kind: "state", platforms: all, relevantWith: REACT },
  { name: "Pinia", kind: "state", platforms: ["web", "desktop"], relevantWith: ["Vue"] },
  { name: "NgRx", kind: "state", platforms: ["web"], relevantWith: ["Angular"] },
  { name: "Riverpod", kind: "state", platforms: ["mobile"], relevantWith: ["Flutter"] },
  { name: "Bloc", kind: "state", platforms: ["mobile"], aliases: ["flutter bloc"], relevantWith: ["Flutter"] },
  { name: "shadcn/ui", kind: "ui", platforms: ["web", "desktop"], aliases: ["shadcn", "radix"], relevantWith: REACT_WEB },
  { name: "Radix UI", kind: "ui", platforms: ["web", "desktop"], relevantWith: REACT_WEB },
  { name: "Material UI", kind: "ui", platforms: ["web", "desktop"], aliases: ["mui"], relevantWith: REACT_WEB },
  { name: "Angular Material", kind: "ui", platforms: ["web"], relevantWith: ["Angular"] },
  { name: "NativeWind", kind: "ui", platforms: ["mobile"], aliases: ["tailwind"], relevantWith: ["React Native"] },
  { name: "Tamagui", kind: "ui", platforms: ["mobile", "web"], relevantWith: ["React Native"] },
  { name: "Framer Motion", kind: "ui", platforms: ["web", "desktop"], aliases: ["motion", "animaciones"], relevantWith: REACT_WEB },
  { name: "Storybook", kind: "tooling", platforms: ["web", "desktop", "mobile"] },
  { name: "Expo Router", kind: "navigation", platforms: ["mobile"], relevantWith: ["Expo"] },
  { name: "React Navigation", kind: "navigation", platforms: ["mobile"], relevantWith: ["React Native"] },
  { name: "Auth.js", kind: "auth", platforms: ["web"], aliases: ["nextauth"], relevantWith: ["Next.js"] },
  { name: "Better Auth", kind: "auth", platforms: ["web", "mobile"], relevantWith: ["TypeScript"] },
  { name: "Clerk", kind: "auth", platforms: all },
  { name: "Auth0", kind: "auth", platforms: all },
  { name: "Firebase Authentication", kind: "auth", platforms: ["mobile", "web"], aliases: ["firebase auth"] },
  { name: "Keycloak", kind: "auth", platforms: ["web"], aliases: ["sso", "oidc"] },
  { name: "Stripe", kind: "payments", platforms: all, aliases: ["pagos"] },
  { name: "PayPal", kind: "payments", platforms: all },
  { name: "Mercado Pago", kind: "payments", platforms: all, aliases: ["mercadopago"] },
  { name: "RevenueCat", kind: "payments", platforms: ["mobile"], aliases: ["suscripciones", "in app purchases"] },
  { name: "WebSockets", kind: "realtime", platforms: all, aliases: ["ws"] },
  { name: "Socket.IO", kind: "realtime", platforms: all, aliases: ["socketio"] },
  { name: "Server-Sent Events", kind: "realtime", platforms: ["web"], aliases: ["sse"] },
  { name: "Pusher", kind: "realtime", platforms: all },
  { name: "Kafka", kind: "messaging", platforms: ["web"], aliases: ["apache kafka"] },
  { name: "RabbitMQ", kind: "messaging", platforms: ["web"], aliases: ["amqp"] },
  { name: "BullMQ", kind: "messaging", platforms: ["web"], aliases: ["colas", "jobs"], relevantWith: ["Bun", "Node.js"] },
  { name: "Temporal", kind: "messaging", platforms: ["web"], aliases: ["workflows"] },
  { name: "Resend", kind: "email", platforms: ["web", "mobile"] },
  { name: "SendGrid", kind: "email", platforms: ["web", "mobile"] },
  { name: "Amazon SES", kind: "email", platforms: ["web"], aliases: ["ses", "aws"] },
  { name: "Twilio", kind: "notifications", platforms: all, aliases: ["sms", "whatsapp"] },
  { name: "Firebase Cloud Messaging", kind: "notifications", platforms: ["mobile", "web"], aliases: ["fcm", "push"] },
  { name: "Expo Notifications", kind: "notifications", platforms: ["mobile"], aliases: ["push"], relevantWith: ["Expo"] },
  { name: "OneSignal", kind: "notifications", platforms: ["mobile", "web"], aliases: ["push"] },
  { name: "Claude API", kind: "ai", platforms: all, aliases: ["anthropic", "llm"] },
  { name: "OpenAI API", kind: "ai", platforms: all, aliases: ["gpt", "llm"] },
  { name: "Vercel AI SDK", kind: "ai", platforms: ["web"], aliases: ["ai sdk", "llm"] },
  { name: "LangChain", kind: "ai", platforms: ["web"], aliases: ["llm"] },
  { name: "Mapbox", kind: "maps", platforms: all },
  { name: "Google Maps", kind: "maps", platforms: all },
  { name: "Leaflet", kind: "maps", platforms: ["web"] },
  { name: "Recharts", kind: "charts", platforms: ["web", "desktop"], relevantWith: REACT_WEB },
  { name: "Chart.js", kind: "charts", platforms: ["web", "desktop"] },
  { name: "D3.js", kind: "charts", platforms: ["web", "desktop"], aliases: ["d3"] },
  { name: "ECharts", kind: "charts", platforms: ["web", "desktop"] },
  { name: "Three.js", kind: "ui", platforms: ["web", "desktop"], aliases: ["3d", "webgl"] },
  { name: "i18next", kind: "i18n", platforms: all, aliases: ["react i18next", "traducciones"] },
  { name: "Docker", kind: "infra", platforms: all, aliases: ["contenedores"] },
  { name: "Kubernetes", kind: "infra", platforms: ["web"], aliases: ["k8s"] },
  { name: "Terraform", kind: "infra", platforms: ["web"], aliases: ["iac"] },
  { name: "Nginx", kind: "infra", platforms: ["web"] },
  { name: "AWS", kind: "deploy", platforms: all, aliases: ["amazon web services"] },
  { name: "Google Cloud", kind: "deploy", platforms: all, aliases: ["gcp"] },
  { name: "Azure", kind: "deploy", platforms: all },
  { name: "Vercel", kind: "deploy", platforms: ["web"] },
  { name: "Netlify", kind: "deploy", platforms: ["web"] },
  { name: "Cloudflare Workers", kind: "deploy", platforms: ["web"], aliases: ["cloudflare"] },
  { name: "Fly.io", kind: "deploy", platforms: ["web"], aliases: ["fly"] },
  { name: "Railway", kind: "deploy", platforms: ["web"] },
  { name: "EAS", kind: "deploy", platforms: ["mobile"], aliases: ["expo application services"], relevantWith: ["Expo"] },
  { name: "Fastlane", kind: "deploy", platforms: ["mobile"] },
  { name: "GitHub Actions", kind: "deploy", platforms: all, aliases: ["ci", "cd"] },
  { name: "Sentry", kind: "observability", platforms: all, aliases: ["errores"] },
  { name: "OpenTelemetry", kind: "observability", platforms: all, aliases: ["otel", "trazas"] },
  { name: "Prometheus", kind: "observability", platforms: ["web"] },
  { name: "Grafana", kind: "observability", platforms: ["web"] },
  { name: "PostHog", kind: "observability", platforms: all, aliases: ["analitica"] },
  { name: "Vite", kind: "tooling", platforms: ["web", "desktop"], relevantWith: ["React", "Vue", "TypeScript"] },
  { name: "Turborepo", kind: "tooling", platforms: all, aliases: ["monorepo"] },
  { name: "Nx", kind: "tooling", platforms: all, aliases: ["monorepo"] },
  { name: "pnpm", kind: "tooling", platforms: all },
  { name: "Biome", kind: "tooling", platforms: all, aliases: ["lint", "formato"], relevantWith: ["TypeScript"] },
  { name: "ESLint", kind: "tooling", platforms: all, aliases: ["lint"], relevantWith: ["TypeScript"] },
  { name: "Prettier", kind: "tooling", platforms: all, aliases: ["formato"], relevantWith: ["TypeScript"] },
].filter((t) => !STACK_OPTIONS.some((o) => o.name === t.name)) as Suggestion<TechKind>[];

/** Autocomplete for "Otras tecnologías". Hides everything already in the stack. */
export function suggestTechnologies(query: string, platforms: Platform[], stack: string[], limit = 8): Suggestion<TechKind>[] {
  return suggestFrom(TECH_SUGGESTIONS, TECH_KIND_LABEL, query, { platforms, selected: stack, limit });
}
