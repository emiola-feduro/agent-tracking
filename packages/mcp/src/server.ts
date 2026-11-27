import {
  buildContextMarkdown,
  DEFAULT_COMMIT_CONVENTIONS,
  missingPlanFields,
  parseProjectPlan,
  PLAN_TEMPLATE,
  PLATFORMS,
  PROJECT_KIND_INFO,
  PROJECT_KINDS,
  REQUIREMENT_AREA_LABEL,
  REQUIREMENT_AREAS,
  REQUIREMENT_TYPES,
  STACK_OPTIONS,
  type ProjectPlan,
  featureProgress,
  requirementProgress,
  SYMBOL_KINDS,
  toPercent,
  type ProjectSnapshot,
} from "@agent-tracking/core";
import { agentForClient } from "@agent-tracking/agents";
import { inspectRepo } from "@agent-tracking/git";
import { createAgentTurns, createProject, saveAttachment, TrackingError, type Tracker } from "@agent-tracking/tracking";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve as resolvePath } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export const SERVER_INFO = { name: "agent-tracking", version: "0.2.0" };

export const SERVER_INSTRUCTIONS = [
  "Agent Tracking muestra al equipo lo que construyes, ordenado por requerimiento, feature y archivo.",
  "Al empezar una tarea, llama a get_project_context para leer reglas de negocio, skills, requerimientos y criterios del DoD.",
  "Mientras trabajas no reportes nada: Agent Tracking ve los archivos que cambias por su cuenta.",
  "Al terminar, antes de tu respuesta final, llama UNA vez a submit_report con todo lo que hiciste:",
  "por cada feature, su requerimiento, sus archivos con propósito y sus funciones, clases o tipos relevantes,",
  "sus tests con resultado, y los criterios del DoD que quedaron cumplidos con su evidencia.",
  "pending_changes lista los archivos cambiados que aún no cubre ningún reporte: inclúyelos.",
  "Las herramientas report_* y start_feature/complete_feature siguen disponibles para reportes parciales.",
  "Para crear un proyecto a partir de un plan usa get_plan_format y luego create_project; si create_project devuelve preguntas, házselas al usuario y vuelve a llamarla con sus respuestas.",
  "Si el proyecto tiene interfaz y creaste o cambiaste una vista, guarda una captura en el repositorio y repórtala con report_screen para la galería.",
].join(" ");

/** Optional services the host provides (the HTTP server has a repository watcher, for example). */
export type McpDeps = {
  syncRepo?: (projectId: string, scope: "changes" | "all") => Promise<unknown>;
};

const TEST_TYPES = ["unit", "integration", "e2e", "component", "contract", "performance", "other"] as const;
const TEST_RESULTS = ["unknown", "passing", "failing", "skipped"] as const;

export type McpSession = {
  /** Default project: its id or any path inside its repository (the agent's cwd). */
  project?: string;
  /** Overrides the actor; defaults to "agent:<client name>" from the MCP handshake. */
  actor?: string;
};

const projectArg = {
  project: z
    .string()
    .optional()
    .describe("Id del proyecto o ruta absoluta dentro de su repositorio. Por defecto, el proyecto de la sesión."),
};

const text = (value: unknown): CallToolResult => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});

const filesOf = (snap: ProjectSnapshot, featureId: string) => {
  const ids = new Set(snap.featureFiles.filter((l) => l.featureId === featureId).map((l) => l.fileId));
  return snap.files
    .filter((f) => ids.has(f.id))
    .map((f) => ({
      id: f.id,
      path: f.path,
      purpose: f.purpose,
      symbols: snap.symbols
        .filter((y) => y.fileId === f.id)
        .map(({ name, kind, lineStart, lineEnd, purpose }) => ({ name, kind, lineStart, lineEnd, purpose })),
    }));
};

/**
 * Builds an MCP server bound to one agent session. Every tool call resolves the project, runs
 * through the shared tracker (database, repo files, live event) and appends to the activity log.
 */
export function createMcpServer(tracker: Tracker, session: McpSession = {}, deps: McpDeps = {}) {
  const server = new McpServer(SERVER_INFO, { instructions: SERVER_INSTRUCTIONS });

  const actor = () => session.actor ?? `agent:${server.server.getClientVersion()?.name ?? "desconocido"}`;

  // Turns for agents seen only through MCP (no hooks): context read = start, final report = end.
  const turns = createAgentTurns(tracker.db, { claudeHome: "" });
  const mcpSession = `mcp:${crypto.randomUUID()}`;
  const agentKind = () => {
    const name = server.server.getClientVersion()?.name ?? "";
    return agentForClient(name) ?? (name || "mcp");
  };
  /** The checkout the agent works in: its own folder when the session names one, else the project's repo. */
  const checkoutOf = async (projectId: string) => {
    const hint = session.project && isAbsolute(session.project) ? session.project : null;
    const fromHint = hint ? (await inspectRepo(hint).catch(() => null))?.root : null;
    return fromHint ?? (await tracker.snapshot(projectId)).project.repoPath ?? "";
  };

  const resolve = async (ref: string | undefined) => {
    const value = ref ?? session.project;
    if (!value) throw new TrackingError("No sé de qué proyecto se trata: pasa `project` con su id o la ruta de su repositorio");
    const id = await tracker.resolveProject(value);
    if (!id) throw new TrackingError(`No hay ningún proyecto de Agent Tracking para "${value}"`, 404);
    return id;
  };

  /**
   * Registers a tool whose handler gets the resolved project and actor. Every call is appended to
   * the activity log; domain errors go back to the agent as tool errors instead of failing the call.
   */
  const register = <S extends z.ZodRawShape>(
    name: string,
    config: { title: string; description: string; inputSchema: S; annotations?: { readOnlyHint?: boolean; openWorldHint?: boolean } },
    handler: (
      projectId: string,
      actor: string,
      args: z.infer<z.ZodObject<S>>,
    ) => Promise<{ result: unknown; event?: Record<string, unknown> }>,
  ) => {
    const run = async ({ project, ...args }: { project?: string } & z.infer<z.ZodObject<S>>): Promise<CallToolResult> => {
      try {
        const projectId = await resolve(project);
        const who = actor();
        const { result, event } = await handler(projectId, who, args as z.infer<z.ZodObject<S>>);
        await tracker.recordEvent(projectId, who, name, event ?? {});
        return text(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (!(e instanceof TrackingError)) console.error(`[mcp] ${name}:`, e);
        return { isError: true, content: [{ type: "text", text: message }] };
      }
    };
    server.registerTool(name, { ...config, inputSchema: { ...projectArg, ...config.inputSchema } }, run as never);
  };

  const readOnly = { readOnlyHint: true, openWorldHint: false };

  register(
    "get_project_context",
    {
      title: "Contexto del proyecto",
      description:
        "Devuelve el CONTEXT.md del proyecto: objetivo, ficha técnica, reglas de negocio, skills, requerimientos con su DoD y features. Llámala al empezar.",
      inputSchema: {},
      annotations: readOnly,
    },
    async (projectId) => {
      const snap = await tracker.snapshot(projectId);
      const checkout = await checkoutOf(projectId);
      if (checkout) await turns.startFromMcp(projectId, { sessionId: mcpSession, agent: agentKind(), checkout }).catch(() => false);
      return { result: `<!-- projectId: ${projectId} -->\n${buildContextMarkdown(snap)}` };
    },
  );

  register(
    "get_project_skills",
    {
      title: "Skills del proyecto",
      description: "Lista las skills habilitadas para el proyecto, con su ubicación para leerlas.",
      inputSchema: {},
      annotations: readOnly,
    },
    async (projectId) => {
      const snap = await tracker.snapshot(projectId);
      const skills = snap.skills
        .filter((k) => k.enabled)
        .map(({ name, description, source, location }) => ({ name, description, source, location }));
      return { result: skills };
    },
  );

  register(
    "list_requirements",
    {
      title: "Listar requerimientos",
      description: "Lista los requerimientos con su avance, criterios del DoD cumplidos y features.",
      inputSchema: {},
      annotations: readOnly,
    },
    async (projectId) => {
      const snap = await tracker.snapshot(projectId);
      const result = snap.requirements.map((r) => {
        const dod = snap.dod.filter((d) => d.requirementId === r.id);
        return {
          id: r.id,
          code: r.code,
          title: r.title,
          description: r.description,
          progress: toPercent(requirementProgress(snap, r.id)),
          dod: { done: dod.filter((d) => d.status === "done").length, total: dod.length },
          features: snap.features
            .filter((f) => f.requirementId === r.id)
            .map(({ id, name, status }) => ({ id, name, status })),
        };
      });
      return { result };
    },
  );

  register(
    "get_requirement",
    {
      title: "Detalle de un requerimiento",
      description:
        "Devuelve un requerimiento con su Definition of Done (ids para mark_dod_item), features, archivos, símbolos, tests e ideas de tests.",
      inputSchema: { requirementId: z.string().describe("Id o código del requerimiento (por ejemplo RF3)") },
      annotations: readOnly,
    },
    async (projectId, _actor, { requirementId }) => {
      const snap = await tracker.snapshot(projectId);
      const { id } = await tracker.resolveRequirement(projectId, requirementId);
      const r = snap.requirements.find((x) => x.id === id)!;
      const features = snap.features.filter((f) => f.requirementId === r.id);
      const result = {
        id: r.id,
        code: r.code,
        title: r.title,
        description: r.description,
        progress: toPercent(requirementProgress(snap, r.id)),
        dod: snap.dod
          .filter((d) => d.requirementId === r.id)
          .map(({ id, criterion, status, evidence }) => ({ id, criterion, status, evidence })),
        features: features.map((f) => ({
          id: f.id,
          name: f.name,
          description: f.description,
          status: f.status,
          agent: f.agent,
          progress: toPercent(featureProgress(f, snap.tests)),
          files: filesOf(snap, f.id),
        })),
        tests: snap.tests
          .filter((t) => t.requirementId === r.id)
          .map(({ id, path, name, type, lastResult, featureId }) => ({ id, path, name, type, lastResult, featureId })),
        testIdeas: snap.testIdeas
          .filter((t) => t.requirementId === r.id)
          .map(({ id, text, status, featureId }) => ({ id, text, status, featureId })),
      };
      return { result, event: { requirementId, title: r.title } };
    },
  );

  register(
    "start_feature",
    {
      title: "Empezar un feature",
      description:
        "Marca un feature como en curso bajo un requerimiento. Si no existe un feature con ese nombre, lo crea. Devuelve su id para report_file y report_test.",
      inputSchema: {
        requirementId: z.string().describe("Requerimiento al que sirve el feature: id o código (RF3)"),
        name: z.string().optional().describe("Nombre corto del feature (obligatorio si no pasas featureId)"),
        featureId: z.string().optional().describe("Id de un feature existente para retomarlo"),
        description: z.string().optional().describe("Qué hará el feature"),
      },
    },
    async (projectId, actor, args) => {
      const { feature, created } = await tracker.startFeature(projectId, actor, args);
      return {
        result: { featureId: feature.id, name: feature.name, status: feature.status, created },
        event: { featureId: feature.id, name: feature.name, requirementId: feature.requirementId, created },
      };
    },
  );

  register(
    "complete_feature",
    {
      title: "Completar un feature",
      description: "Marca un feature como terminado, o como pendiente de revisión si alguien debe validarlo.",
      inputSchema: {
        featureId: z.string(),
        status: z.enum(["done", "needs_review"]).default("done"),
        summary: z.string().optional().describe("Resumen breve de lo que se hizo"),
      },
    },
    async (projectId, actor, { featureId, status, summary }) => {
      const feature = await tracker.completeFeature(projectId, actor, featureId, status);
      return {
        result: { featureId: feature.id, status: feature.status },
        event: { featureId, name: feature.name, status, ...(summary ? { summary } : {}) },
      };
    },
  );

  register(
    "report_file",
    {
      title: "Reportar un archivo",
      description:
        "Registra un archivo que creaste o modificaste, con su propósito y los features a los que sirve. Un archivo puede servir a varios features.",
      inputSchema: {
        path: z.string().describe("Ruta relativa a la raíz del repo (o absoluta dentro de él)"),
        purpose: z.string().optional().describe("Para qué existe el archivo, en una frase"),
        featureIds: z.array(z.string()).optional().describe("Features a los que sirve"),
      },
    },
    async (projectId, actor, args) => {
      const { file, featureIds } = await tracker.reportFile(projectId, actor, args);
      return {
        result: { fileId: file.id, path: file.path, featureIds },
        event: { fileId: file.id, path: file.path, featureIds },
      };
    },
  );

  register(
    "report_symbol",
    {
      title: "Reportar un símbolo",
      description:
        "Registra una función, clase, variable, tipo o constante de un archivo, con su propósito. Si el archivo no estaba reportado, lo registra.",
      inputSchema: {
        path: z.string().describe("Archivo que contiene el símbolo"),
        name: z.string().min(1),
        kind: z.enum(SYMBOL_KINDS),
        lineStart: z.number().int().positive().optional(),
        lineEnd: z.number().int().positive().optional(),
        purpose: z.string().optional(),
      },
    },
    async (projectId, actor, args) => {
      const { file, symbol } = await tracker.reportSymbol(projectId, actor, args);
      return {
        result: { symbolId: symbol.id, fileId: file.id, path: file.path },
        event: { symbolId: symbol.id, name: symbol.name, kind: symbol.kind, path: file.path },
      };
    },
  );

  register(
    "report_test",
    {
      title: "Reportar un test",
      description: "Registra o actualiza un test (por ruta y nombre), su tipo, su último resultado y el feature que valida.",
      inputSchema: {
        path: z.string(),
        name: z.string().min(1),
        type: z.enum(["unit", "integration", "e2e", "component", "contract", "performance", "other"]).optional(),
        result: z.enum(["unknown", "passing", "failing", "skipped"]).optional(),
        featureId: z.string().optional(),
        requirementId: z.string().optional().describe("Id o código del requerimiento (RF3)"),
      },
    },
    async (projectId, actor, args) => {
      const test = await tracker.reportTest(projectId, actor, args);
      return {
        result: { testId: test.id, lastResult: test.lastResult },
        event: { testId: test.id, name: test.name, path: test.path, type: test.type, result: test.lastResult },
      };
    },
  );

  register(
    "mark_dod_item",
    {
      title: "Marcar criterio del DoD",
      description: "Cambia el estado de un criterio de la Definition of Done. Incluye evidencia (test, archivo, comando) al marcarlo.",
      inputSchema: {
        dodId: z.string(),
        status: z.enum(["done", "failed", "pending"]).default("done"),
        evidence: z.string().optional(),
      },
    },
    async (projectId, actor, { dodId, status, evidence }) => {
      const dod = await tracker.updateDod(projectId, actor, dodId, { status, ...(evidence !== undefined ? { evidence } : {}) });
      return {
        result: { dodId: dod.id, status: dod.status },
        event: { dodId, criterion: dod.criterion, status, requirementId: dod.requirementId },
      };
    },
  );

  register(
    "suggest_test_idea",
    {
      title: "Sugerir idea de test",
      description: "Registra un caso que vale la pena probar, ligado opcionalmente a un feature o requerimiento.",
      inputSchema: {
        text: z.string().min(1),
        featureId: z.string().optional(),
        requirementId: z.string().optional().describe("Id o código del requerimiento (RF3)"),
      },
    },
    async (projectId, actor, args) => {
      const idea = await tracker.addTestIdea(projectId, actor, { ...args, origin: "llm" });
      return { result: { ideaId: idea.id }, event: { ideaId: idea.id, text: idea.text, featureId: idea.featureId } };
    },
  );

  register(
    "report_screen",
    {
      title: "Reportar una vista",
      description:
        "Agrega a la galería del proyecto una captura de una vista de la app (PNG, JPEG o WebP guardada dentro del repositorio, por ejemplo con Playwright). Repórtala otra vez cuando cambie.",
      inputSchema: {
        title: z.string().min(1).max(200).describe("Nombre de la vista, por ejemplo 'Lista de gastos'"),
        imagePath: z.string().min(1).describe("Ruta de la captura, relativa al repositorio o absoluta dentro de él"),
        route: z.string().max(300).optional().describe("Ruta o pantalla donde vive, por ejemplo /gastos"),
        featureId: z.string().optional(),
      },
    },
    async (projectId, actor, args) => {
      const snap = await tracker.snapshot(projectId);
      const root = snap.project.repoPath;
      if (!root) throw new TrackingError("El proyecto no tiene repositorio local: no puedo leer la captura");
      const path = resolvePath(root, args.imagePath);
      const rel = relative(root, path);
      if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new TrackingError("La captura debe estar dentro del repositorio del proyecto");
      const bytes = await readFile(join(root, rel)).catch(() => null);
      if (!bytes) throw new TrackingError(`No encuentro la captura ${rel}`, 404);
      const screen = await saveAttachment(tracker.db, tracker, projectId, actor, {
        kind: "screen",
        title: args.title,
        route: args.route ?? "",
        featureId: args.featureId ?? null,
        filename: rel.split("/").pop() ?? "captura.png",
        bytes: new Uint8Array(bytes),
      });
      return { result: { screenId: screen.id }, event: { screenId: screen.id, title: args.title } };
    },
  );

  /** Brings repository analysis up to date first, so pending files include the latest edits. */
  const refreshRepo = async (projectId: string) => {
    if (deps.syncRepo) await deps.syncRepo(projectId, "changes").catch(() => {});
  };

  register(
    "pending_changes",
    {
      title: "Cambios sin reportar",
      description: "Archivos del repositorio que cambiaron después del último reporte que los cubrió. Inclúyelos en submit_report.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async (projectId) => {
      await refreshRepo(projectId);
      const pending = await tracker.pendingChanges(projectId);
      return { result: { pending }, event: { count: pending.length } };
    },
  );

  register(
    "submit_report",
    {
      title: "Reporte final del trabajo",
      description:
        "Llámalo una vez al terminar. Registra los features con su estado, sus archivos (propósito y símbolos relevantes), " +
        "sus tests y los criterios del DoD cumplidos. Un feature con el mismo nombre en el mismo requerimiento se actualiza. " +
        "Devuelve los archivos cambiados que siguen sin reportar.",
      inputSchema: {
        summary: z.string().optional().describe("Qué hiciste, en dos o tres frases"),
        features: z
          .array(
            z.object({
              requirementId: z.string().describe("Requerimiento al que sirve: id o código como RF3 (ver get_project_context)"),
              name: z.string().describe("Nombre corto del feature"),
              featureId: z.string().optional().describe("Id de un feature existente, para actualizarlo"),
              description: z.string().optional(),
              status: z.enum(["in_progress", "done", "needs_review"]).optional().describe("Por defecto done"),
              files: z
                .array(
                  z.object({
                    path: z.string().describe("Ruta relativa a la raíz del repo"),
                    purpose: z.string().optional().describe("Para qué existe el archivo, en una frase"),
                    symbols: z
                      .array(
                        z.object({
                          name: z.string(),
                          kind: z.enum(SYMBOL_KINDS),
                          purpose: z.string().optional(),
                          lineStart: z.number().int().positive().optional(),
                          lineEnd: z.number().int().positive().optional(),
                        }),
                      )
                      .optional(),
                  }),
                )
                .optional(),
              tests: z
                .array(
                  z.object({
                    path: z.string(),
                    name: z.string(),
                    type: z.enum(TEST_TYPES).optional(),
                    result: z.enum(TEST_RESULTS).optional(),
                  }),
                )
                .optional(),
            }),
          )
          .describe("Lo que hiciste, por feature"),
        dod: z
          .array(
            z.object({
              id: z.string().describe("Id del criterio (ver get_project_context)"),
              status: z.enum(["pending", "done", "failed"]),
              evidence: z.string().optional().describe("Cómo se comprueba: test, archivo, comando"),
            }),
          )
          .optional(),
        testIdeas: z.array(z.object({ text: z.string(), requirementId: z.string().optional() })).optional(),
      },
    },
    async (projectId, actor, args) => {
      await refreshRepo(projectId);
      const result = await tracker.submitReport(projectId, actor, args);
      const summary = args.summary?.trim() || `Reportó: ${args.features.map((f) => f.name).join(", ")}.`;
      const closed = await turns.finishFromMcp(projectId, { sessionId: mcpSession, summary, cwd: await checkoutOf(projectId) }).catch(() => false);
      if (closed) tracker.emit({ type: "changed", projectId, entity: "turn" });
      return {
        result,
        event: { summary: args.summary ?? "", ...result.counts, features: result.features.map((f) => f.name), pending: result.pending.length },
      };
    },
  );

  if (deps.syncRepo) {
    const syncRepo = deps.syncRepo;
    register(
      "sync_repo",
      {
        title: "Analizar el repositorio",
        description:
          "Analiza ahora el código del repositorio: registra archivos, funciones, clases y tests detectados como inferidos. " +
          "`changes` (por defecto) revisa los cambios sin commit y los liga al feature en curso; `all` recorre todo el repositorio.",
        inputSchema: { scope: z.enum(["changes", "all"]).optional() },
      },
      async (projectId, _actor, args) => {
        const result = await syncRepo(projectId, args.scope ?? "changes");
        return { result, event: { scope: args.scope ?? "changes" } };
      },
    );
  }

  server.registerTool(
    "get_plan_format",
    {
      title: "Formato de un plan de proyecto",
      description:
        "Explica cómo escribir un plan para create_project: el formato Markdown (o JSON), los valores permitidos y lo que Agent Tracking necesita sí o sí. Llámala antes de create_project.",
      inputSchema: {},
      annotations: readOnly,
    },
    async () =>
      text(
        [
          "Un plan es Markdown como este (también se acepta JSON con los mismos campos):",
          "",
          PLAN_TEMPLATE,
          "Opcional: una sección ## Convenciones de commits con las reglas del equipo, una por línea; sin ella se usan Conventional Commits (feat, fix, docs...) y ramas tipo/tema.",
          "Obligatorio: nombre (# Título), Tipo, Objetivo y al menos un requerimiento. Plataformas solo si el tipo es aplicación completa o app multiplataforma.",
          "Cada requerimiento debería tener criterios del Definition of Done (lista o checklist debajo de su título).",
          `Tipos de proyecto: ${PROJECT_KINDS.map((k) => `${k} (${PROJECT_KIND_INFO[k].label})`).join(", ")}.`,
          `Plataformas: ${PLATFORMS.join(", ")}.`,
          `Tipos de requerimiento: ${REQUIREMENT_TYPES.join(", ")} (funcional = lo que hace; no funcional = qué tan bien lo hace).`,
          `Áreas: ${REQUIREMENT_AREAS.map((a) => `${a} (${REQUIREMENT_AREA_LABEL[a]})`).join(", ")}. Las de calidad (rendimiento, seguridad...) son para no funcionales; si falta, se deduce del texto.`,
          `Stack sugerido del catálogo: ${STACK_OPTIONS.map((o) => o.name).join(", ")}. Se aceptan otras tecnologías.`,
          "No inventes lo que el usuario no dijo: si falta algo obligatorio, create_project devolverá las preguntas para hacérselas.",
        ].join("\n"),
      ),
  );

  server.registerTool(
    "create_project",
    {
      title: "Crear proyecto desde un plan",
      description:
        "Crea un proyecto en Agent Tracking a partir de un plan (Markdown o JSON, ver get_plan_format). Si falta algo que el wizard pide sí o sí, no crea nada y devuelve `questions`: házselas al usuario (por ejemplo con AskUserQuestion), agrega las respuestas al plan y vuelve a llamarla.",
      inputSchema: {
        plan: z.string().min(1).describe("El plan en Markdown o JSON"),
        repoPath: z.string().optional().describe("Ruta absoluta del repositorio git del proyecto (normalmente tu directorio de trabajo). Opcional."),
        githubFiles: z
          .array(z.enum(["ci", "prTemplate"]))
          .optional()
          .describe("Archivos iniciales de .github a escribir en el repo, solo si el usuario los pidió"),
      },
    },
    (async ({ plan, repoPath, githubFiles }: { plan: string; repoPath?: string; githubFiles?: ("ci" | "prTemplate")[] }): Promise<CallToolResult> => {
      try {
        const parsed = parseProjectPlan(plan);
        if (!parsed.ok) return { isError: true, content: [{ type: "text", text: parsed.error }] };
        const value: ProjectPlan = parsed.value;
        const missing = missingPlanFields(value);
        const blocking = missing.filter((m) => m.field !== "dod");
        if (blocking.length > 0) {
          return text({
            created: false,
            message: "Faltan datos que el usuario debe dar. Pregúntaselos y vuelve a llamar a create_project con el plan completo.",
            questions: missing,
            understood: { ...value, requirements: value.requirements.map((r) => ({ title: r.title, type: r.type, area: r.area, criteria: r.dod.length })) },
            warnings: parsed.warnings,
          });
        }
        const projectId = await createProject(
          tracker.db,
          tracker.emit,
          {
            name: value.name,
            goal: value.goal,
            kind: value.kind!,
            platforms: value.platforms,
            stack: value.stack,
            databases: value.databases,
            repoPath: repoPath ?? null,
            rules: value.rules,
            commitConventions: value.conventions ? { ...DEFAULT_COMMIT_CONVENTIONS, custom: value.conventions } : null,
            requirements: value.requirements.map((r) => ({ ...r, dod: r.dod.map((criterion) => ({ criterion })) })),
            githubFiles,
          },
          actor(),
        );
        await tracker.recordEvent(projectId, actor(), "create_project", { name: value.name, requirements: value.requirements.length });
        session.project ??= projectId;
        return text({
          created: true,
          projectId,
          requirements: value.requirements.length,
          warnings: parsed.warnings,
          followUp: missing.length ? missing : undefined,
          next: "Revisa el proyecto en Agent Tracking. Si quedaron requerimientos sin criterios del DoD, pregúntale al usuario por ellos.",
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (!(e instanceof TrackingError)) console.error("[mcp] create_project:", e);
        return { isError: true, content: [{ type: "text", text: message }] };
      }
    }) as never,
  );

  return server;
}
