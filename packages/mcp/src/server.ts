import {
  buildContextMarkdown,
  featureProgress,
  requirementProgress,
  SYMBOL_KINDS,
  toPercent,
  type ProjectSnapshot,
} from "@agent-tracking/core";
import { TrackingError, type Tracker } from "@agent-tracking/tracking";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export const SERVER_INFO = { name: "agent-tracking", version: "0.2.0" };

export const SERVER_INSTRUCTIONS = [
  "Agent Tracking registra en tiempo real lo que construyes para que el equipo lo vea.",
  "Al empezar, llama a get_project_context y lee las reglas de negocio, skills y requerimientos.",
  "Antes de trabajar en algo llama a start_feature con el requerimiento que atiende.",
  "Reporta cada archivo que crees o cambies con report_file (con su propósito y los features a los que sirve)",
  "y sus funciones, clases, tipos, variables o constantes relevantes con report_symbol.",
  "Reporta tus tests con report_test, marca criterios del DoD con mark_dod_item cuando tengas evidencia",
  "y cierra con complete_feature. Usa suggest_test_idea para casos que convenga probar más adelante.",
].join(" ");

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
export function createMcpServer(tracker: Tracker, session: McpSession = {}) {
  const server = new McpServer(SERVER_INFO, { instructions: SERVER_INSTRUCTIONS });

  const actor = () => session.actor ?? `agent:${server.server.getClientVersion()?.name ?? "desconocido"}`;

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
      inputSchema: { requirementId: z.string().describe("Id del requerimiento") },
      annotations: readOnly,
    },
    async (projectId, _actor, { requirementId }) => {
      const snap = await tracker.snapshot(projectId);
      const r = snap.requirements.find((x) => x.id === requirementId);
      if (!r) throw new TrackingError(`Requerimiento no encontrado: ${requirementId}`, 404);
      const features = snap.features.filter((f) => f.requirementId === r.id);
      const result = {
        id: r.id,
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
        requirementId: z.string().describe("Requerimiento al que sirve el feature"),
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
        requirementId: z.string().optional(),
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
        requirementId: z.string().optional(),
      },
    },
    async (projectId, actor, args) => {
      const idea = await tracker.addTestIdea(projectId, actor, { ...args, origin: "llm" });
      return { result: { ideaId: idea.id }, event: { ideaId: idea.id, text: idea.text, featureId: idea.featureId } };
    },
  );

  return server;
}
