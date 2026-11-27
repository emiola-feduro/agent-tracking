import {
  buildContextMarkdown,
  DEFAULT_COMMIT_CONVENTIONS,
  DEFAULT_REPLY_LANGUAGE,
  defaultTestTypes,
  MONOREPO_TOOLS,
  missingPlanFields,
  PLAN_MONOREPO_EXAMPLE,
  recommendMonorepoTool,
  REPLY_LANGUAGES,
  TEST_POLICY_TYPES,
  type ProjectPart,
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
import { buildHandoff } from "./handoff";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isAbsolute, join, relative, resolve as resolvePath } from "node:path";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
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
  "Si retomas el trabajo de otra sesión, get_handoff dice qué hizo el último turno, qué criterios del DoD siguen pendientes y qué falta por reportar.",
  "Las herramientas report_* y start_feature/complete_feature siguen disponibles para reportes parciales.",
  "Si reportaste un test o un feature por error, deshazlo con remove_test o remove_feature.",
  "Para crear un proyecto a partir de un plan usa get_plan_format y luego create_project; si create_project devuelve preguntas, házselas al usuario y vuelve a llamarla con sus respuestas.",
  "Si el proyecto tiene interfaz y creaste o cambiaste una vista, guarda una captura en el repositorio y repórtala con report_screen para la galería.",
].join(" ");

/** Optional services the host provides (the HTTP server has a repository watcher, for example). */
export type McpDeps = {
  syncRepo?: (projectId: string, scope: "changes" | "all") => Promise<unknown>;
  /** Runs before every tool; throwing stops it with that message (e.g. a database newer than this code). */
  beforeTool?: () => void;
  /**
   * The folder an agent of this kind last worked in, as its hooks reported it. Agents connected over
   * HTTP have no working folder of their own here; this is their fallback when they declare no roots.
   */
  lastAgentDir?: (agent: string) => string | null;
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

/** A requirement with its Definition of Done, features (files and symbols), tests and test ideas. */
export const requirementDetail = (snap: ProjectSnapshot, id: string) => {
  const r = snap.requirements.find((x) => x.id === id)!;
  const features = snap.features.filter((f) => f.requirementId === r.id);
  return {
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
  /**
   * Where the agent works, when it does not pass `project`: the folder the session was opened for
   * (stdio bridge), else the roots the agent declares (MCP roots), else where its hooks last saw it.
   */
  let hinted: Promise<string | undefined> | undefined;
  const projectHint = () =>
    (hinted ??= (async () => {
      if (session.project) return session.project;
      if (server.server.getClientCapabilities()?.roots) {
        const roots = await server.server.listRoots(undefined, { timeout: 3000 }).catch(() => null);
        const dir = roots?.roots.map((r) => (r.uri.startsWith("file://") ? fileURLToPath(r.uri) : null)).find(Boolean);
        if (dir) return dir;
      }
      return deps.lastAgentDir?.(agentKind()) ?? undefined;
    })().then((v) => {
      // Asked again next time when nothing was found (the hooks may report a folder later).
      if (!v) hinted = undefined;
      return v;
    }));

  /** The checkout the agent works in: its own folder when the session names one, else the project's repo. */
  const checkoutOf = async (projectId: string) => {
    const where = await projectHint();
    const hint = where && isAbsolute(where) ? where : null;
    const fromHint = hint ? (await inspectRepo(hint).catch(() => null))?.root : null;
    return fromHint ?? (await tracker.snapshot(projectId)).project.repoPath ?? "";
  };

  const resolve = async (ref: string | undefined) => {
    const value = ref ?? (await projectHint());
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
    config: { title: string; description: string; inputSchema: S; annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; openWorldHint?: boolean } },
    handler: (
      projectId: string,
      actor: string,
      args: z.infer<z.ZodObject<S>>,
    ) => Promise<{ result: unknown; event?: Record<string, unknown> }>,
  ) => {
    const run = async ({ project, ...args }: { project?: string } & z.infer<z.ZodObject<S>>): Promise<CallToolResult> => {
      try {
        deps.beforeTool?.();
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
      const result = requirementDetail(snap, id);
      return { result, event: { requirementId, title: result.title } };
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
    "remove_test",
    {
      title: "Quitar un test",
      description:
        "Deshace un test reportado por error: lo quita del proyecto. Indica su testId, o la ruta y el nombre con que lo reportaste.",
      inputSchema: {
        testId: z.string().optional(),
        path: z.string().optional().describe("Ruta del test, con name, si no tienes su id"),
        name: z.string().optional(),
      },
      annotations: { destructiveHint: true, openWorldHint: false },
    },
    async (projectId, _actor, { testId, path, name }) => {
      if (!testId && !(path && name)) throw new TrackingError("Indica testId, o path y name del test");
      const test = testId
        ? (await tracker.snapshot(projectId)).tests.find((t) => t.id === testId)
        : await tracker.findTest(projectId, { path: path!, name: name! });
      if (!test) throw new TrackingError(`Test no encontrado: ${testId}`, 404);
      await tracker.deleteTest(projectId, test.id);
      return {
        result: { removed: { testId: test.id, path: test.path, name: test.name } },
        event: { testId: test.id, path: test.path, name: test.name },
      };
    },
  );

  register(
    "remove_feature",
    {
      title: "Quitar un feature",
      description:
        "Deshace un feature reportado por error: lo quita de su requerimiento junto con sus enlaces a archivos. " +
        "Sus tests quedan en el proyecto sin feature y se devuelven; quítalos con remove_test si también sobran.",
      inputSchema: { featureId: z.string() },
      annotations: { destructiveHint: true, openWorldHint: false },
    },
    async (projectId, _actor, { featureId }) => {
      const { feature, tests } = await tracker.deleteFeature(projectId, featureId);
      return {
        result: { removed: { featureId: feature.id, name: feature.name }, testsWithoutFeature: tests },
        event: { featureId: feature.id, name: feature.name, requirementId: feature.requirementId },
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
    "get_handoff",
    {
      title: "Retomar el trabajo",
      description:
        "Para continuar lo que dejó otra sesión: qué hizo el último turno (agente, rama, pedido, resumen y archivos), " +
        "qué criterios del DoD siguen pendientes y qué archivos cambiados faltan por reportar.",
      inputSchema: {
        requirementId: z.string().optional().describe("Id o código (RF3) para ver solo los criterios pendientes de ese requerimiento"),
      },
      annotations: { readOnlyHint: true },
    },
    async (projectId, _actor, { requirementId }) => {
      await refreshRepo(projectId);
      const scope = requirementId ? (await tracker.resolveRequirement(projectId, requirementId)).id : undefined;
      const [snap, recent, pending] = await Promise.all([
        tracker.snapshot(projectId),
        turns.list(projectId, 20),
        tracker.pendingChanges(projectId),
      ]);
      const result = buildHandoff(snap, recent, pending, scope);
      return {
        result,
        event: { lastTurn: result.lastTurn?.agent ?? null, pendingDod: result.pendingDod.length, pending: pending.length },
      };
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
          "Monorepo: pon `Estructura: monorepo` y describe cada pieza bajo ## Piezas (### Nombre con Tipo, Carpeta, Plataformas si su tipo las pide, y Stack). Cada requerimiento puede decir qué piezas toca con `Piezas: A, B`. El tipo, las plataformas y el stack del proyecto salen de sus piezas, como en el wizard. Por ejemplo:",
          "",
          PLAN_MONOREPO_EXAMPLE,
          `Herramienta de monorepo (opcional, por defecto la recomendada para sus piezas): ${MONOREPO_TOOLS.map((t) => t.id).join(", ")}.`,
          `Tests (opcional): los tipos de tests que escriben los agentes, de ${TEST_POLICY_TYPES.map((t) => `${t.type} (${t.label})`).join(", ")}; sin la línea se usan los habituales para el tipo de proyecto.`,
          `Idioma (opcional): el idioma de las respuestas de los agentes, ${REPLY_LANGUAGES.join(", ")} o ninguno; por defecto ${DEFAULT_REPLY_LANGUAGE}.`,
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
        "Crea un proyecto en Agent Tracking a partir de un plan (Markdown o JSON, ver get_plan_format), con lo mismo que el wizard: monorepo con sus piezas, tipos de tests e idioma de las respuestas. Si falta algo que el wizard pide sí o sí, no crea nada y devuelve `questions`: házselas al usuario (por ejemplo con AskUserQuestion), agrega las respuestas al plan y vuelve a llamarla.",
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
            understood: { ...value, requirements: value.requirements.map((r) => ({ title: r.title, type: r.type, area: r.area, parts: r.parts, criteria: r.dod.length })) },
            warnings: parsed.warnings,
          });
        }
        const kind = value.kind!;
        const monorepo = value.structure === "monorepo";
        // parseProjectPlan only leaves a monorepo without missing fields when every piece has a kind.
        const parts = monorepo ? (value.parts as ProjectPart[]) : [];
        const projectId = await createProject(
          tracker.db,
          tracker.emit,
          {
            name: value.name,
            goal: value.goal,
            kind,
            platforms: value.platforms,
            stack: value.stack,
            databases: value.databases,
            structure: value.structure,
            parts,
            monorepoTool: monorepo ? (value.monorepoTool ?? recommendMonorepoTool(parts)) : null,
            testTypes: value.testTypes ?? defaultTestTypes(kind),
            replyLanguage: value.replyLanguage === undefined ? DEFAULT_REPLY_LANGUAGE : value.replyLanguage,
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

  registerResources(server, {
    context: async () => {
      const snap = await tracker.snapshot(await resolve(undefined));
      return buildContextMarkdown(snap);
    },
    requirements: async () => {
      const snap = await tracker.snapshot(await resolve(undefined));
      return snap.requirements.map(({ id, code, title }) => ({ id, code: code ?? null, title }));
    },
    requirement: async (ref) => {
      const projectId = await resolve(undefined);
      const snap = await tracker.snapshot(projectId);
      const { id } = await tracker.resolveRequirement(projectId, ref);
      return requirementDetail(snap, id);
    },
  });

  registerPrompts(server, async (requirement) => {
    // Best effort: the prompt still works when the project or the requirement cannot be resolved.
    try {
      const projectId = await resolve(undefined);
      const snap = await tracker.snapshot(projectId);
      const { id } = await tracker.resolveRequirement(projectId, requirement);
      const r = snap.requirements.find((x) => x.id === id);
      if (!r) return null;
      const pending = snap.dod.filter((d) => d.requirementId === id && d.status !== "done");
      return { code: r.code ?? null, title: r.title, pending: pending.map(({ id, criterion }) => ({ id, criterion })) };
    } catch {
      return null;
    }
  });

  return server;
}

/** What the start prompt knows about a requirement when it can be resolved. */
export type PromptRequirement = { code: string | null; title: string; pending: { id: string; criterion: string }[] };

/** Text of the start prompt: the workflow to implement a requirement, with its pending DoD when known. */
export function startPromptText(requirement: string, found: PromptRequirement | null): string {
  const name = found ? `${found.code ?? requirement} "${found.title}"` : requirement;
  const lines = [
    `Work on requirement ${name} of this project, which is tracked with Agent Tracking.`,
    "",
    "1. Call get_project_context (agent-tracking MCP server) and read the goal, business rules, conventions and the reply language.",
    `   If it does not recognize the project, pass \`project\` with the absolute path of this repository.`,
    `2. Call get_requirement with "${requirement}" to read its description, Definition of Done, features and tests.`,
    "3. Before changing code, create a branch from the current one with `git switch -c feat/<topic>` (or fix/), unless you are already on a work branch. Never push or merge into main.",
    "4. Meet the pending Definition of Done criteria, write the tests the project asks for and run them. Commit with the project's conventions.",
    "5. When everything is done, run the report prompt (/agent-tracking:report) or call submit_report once.",
  ];
  if (found) {
    lines.push("", "Pending Definition of Done criteria:");
    if (found.pending.length) lines.push(...found.pending.map((d) => `- ${d.criterion} (id ${d.id})`));
    else lines.push("- None: every criterion is done. Ask the user what is left before changing code.");
  }
  lines.push("", "Talk to the user in the reply language set in the project context.");
  return lines.join("\n");
}

/** Text of the report prompt: how to close a task with a single, complete submit_report. */
export const REPORT_PROMPT_TEXT = [
  "Report the work of this task to Agent Tracking.",
  "",
  "1. Call pending_changes (agent-tracking MCP server) to list the changed files that no report covers yet.",
  "2. Make sure the work is committed with the project's conventions.",
  "3. Call submit_report ONCE with everything you did, grouped by requirement and feature:",
  "   - each feature with its requirement (id or code such as RF3), description and status;",
  "   - its files with their purpose and the relevant functions, classes or types (with lines);",
  "   - its tests with their type and last result;",
  "   - the Definition of Done criteria you met, by id, with their evidence (test, file or command).",
  "   Include every file pending_changes listed.",
  "4. If you changed a view of the app, save a screenshot in the repository and report it with report_screen.",
  "",
  "Write the summary of submit_report and your reply in the reply language set in the project context.",
].join("\n");

/**
 * MCP prompts, shown by agents as commands: /agent-tracking:start <requirement> and /agent-tracking:report.
 * `lookup` resolves the requirement in the session's project to list its pending criteria.
 */
function registerPrompts(server: McpServer, lookup: (requirement: string) => Promise<PromptRequirement | null>) {
  server.registerPrompt(
    "start",
    {
      title: "Start a requirement",
      description: "Read the project context and the requirement, create a work branch and implement its pending Definition of Done",
      argsSchema: { requirement: z.string().describe("Requirement id or code, for example RF3") },
    },
    async ({ requirement }) => ({
      messages: [{ role: "user", content: { type: "text", text: startPromptText(requirement, await lookup(requirement)) } }],
    }),
  );
  server.registerPrompt(
    "report",
    {
      title: "Report the work",
      description: "Send Agent Tracking a single submit_report with features, files, tests and the Definition of Done criteria met",
    },
    async () => ({ messages: [{ role: "user", content: { type: "text", text: REPORT_PROMPT_TEXT } }] }),
  );
}

/** URIs of the MCP resources: the project context and each requirement. */
export const CONTEXT_URI = "agent-tracking://context";
export const requirementUri = (id: string) => `agent-tracking://requirement/${encodeURIComponent(id)}`;

/** Reads the session's project for the MCP resources. */
type ResourceSource = {
  context: () => Promise<string>;
  requirements: () => Promise<{ id: string; code: string | null; title: string }[]>;
  /** Detail of a requirement by id or code (RF3). */
  requirement: (ref: string) => Promise<unknown>;
};

/**
 * MCP resources, readable without a tool call: agent-tracking://context (CONTEXT.md of the session's
 * project) and agent-tracking://requirement/<id> (a requirement with its DoD, features and tests).
 * The requirement template lists every requirement of the project and also accepts its code.
 */
function registerResources(server: McpServer, source: ResourceSource) {
  server.registerResource(
    "context",
    CONTEXT_URI,
    {
      title: "Project context",
      description: "CONTEXT.md of the project: goal, business rules, conventions, skills and requirements with their Definition of Done",
      mimeType: "text/markdown",
    },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: await source.context() }] }),
  );
  server.registerResource(
    "requirement",
    new ResourceTemplate("agent-tracking://requirement/{id}", {
      list: async () => ({
        resources: (await source.requirements().catch(() => [])).map((r) => ({
          uri: requirementUri(r.id),
          name: r.code ? `${r.code} ${r.title}` : r.title,
          mimeType: "application/json",
        })),
      }),
    }),
    {
      title: "Requirement",
      description: "A requirement with its Definition of Done (ids and status), features, files, symbols, tests and test ideas",
      mimeType: "application/json",
    },
    async (uri, { id }) => {
      const ref = decodeURIComponent(String(Array.isArray(id) ? id[0] : id));
      const detail = await source.requirement(ref);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(detail, null, 2) }] };
    },
  );
}
