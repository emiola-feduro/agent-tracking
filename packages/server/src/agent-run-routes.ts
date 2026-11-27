import { AGENT_KINDS, LAUNCH_BINARIES, LAUNCH_PERMISSIONS, launchCommand, launchLabel, launchPrompt, type AgentKind, type LaunchItem, type LaunchPermission } from "@agent-tracking/agents";
import { dodImplementable, requirementImplementable } from "@agent-tracking/core";
import { listWorktrees } from "@agent-tracking/git";
import type { Tracker } from "@agent-tracking/tracking";
import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { resolve } from "node:path";
import { z } from "zod";
import { isLocalOrigin } from "./origin";

/** A started agent process, as the routes need it; tests pass a fake one. */
export type AgentProcess = { stdout: ReadableStream<Uint8Array>; stderr: ReadableStream<Uint8Array>; exited: Promise<number>; kill: () => void };
export type SpawnAgent = (argv: string[], cwd: string) => AgentProcess;

export type AgentRun = {
  id: string;
  projectId: string;
  /** What it works on, in order: each requirement and how many of its criteria (null: the whole requirement). */
  tasks: { requirementId: string; code: string | null; title: string; criteria: number | null }[];
  /** Short description of the tasks ("RF3 y 2 criterios de RF5"). */
  label: string;
  agent: AgentKind;
  cwd: string;
  permission: LaunchPermission;
  /** queued: waits for the agent working in the same checkout to finish. */
  status: "queued" | "running" | "done" | "failed" | "stopped";
  /** When it was asked for; startedAt is when the agent actually started. */
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  exitCode: number | null;
  /** The last lines the agent printed (stdout and stderr). */
  output: string[];
};

const MAX_LINES = 200;

const defaultSpawn: SpawnAgent = (argv, cwd) => {
  const proc = Bun.spawn(argv, { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  return { stdout: proc.stdout, stderr: proc.stderr, exited: proc.exited, kill: () => proc.kill() };
};

const launchInput = z.object({
  /** Requirements (whole, or only the listed criteria) in the order the agent should take them. */
  items: z
    .array(z.object({ requirementId: z.string().min(1), dodIds: z.array(z.string()).max(100).optional() }))
    .min(1, "Elige al menos un requerimiento o criterio")
    .max(50),
  agent: z.enum(AGENT_KINDS),
  /** The project's main checkout or one of its worktrees; the main checkout when missing. */
  cwd: z.string().optional(),
  permission: z.enum(LAUNCH_PERMISSIONS).default("safe"),
  model: z.string().trim().max(100).regex(/^[\w.:/@-]*$/, "Nombre de modelo no válido").optional(),
  instructions: z.string().max(10_000).optional(),
});

/**
 * Starting agents runs programs on this machine: only this machine's own pages may ask for it. The
 * Origin header is required here (browsers always send it with these requests), so neither another
 * site nor a page served to another computer can start one.
 */
const localOnly = (c: Context) => {
  const origin = c.req.header("origin");
  if (!origin || !isLocalOrigin(origin)) throw new HTTPException(403, { message: "Solo se pueden lanzar agentes desde Agent Tracking en este equipo" });
};

/**
 * Agents started from Agent Tracking on a requirement. Runs live in memory (they are processes of
 * this server); what the agent builds is tracked as always, through its hooks and its report.
 *
 *   GET  /projects/:id/runs                 this project's runs, newest first
 *   POST /projects/:id/runs                 starts an agent: { requirementId, agent, cwd?, permission, model?, instructions? }
 *   POST /projects/:id/runs/:runId/stop     stops a running agent
 */
export function agentRunRoutes(tracker: Tracker, opts: { spawn?: SpawnAgent; which?: (bin: string) => string | null } = {}) {
  const app = new Hono();
  const spawn = opts.spawn ?? defaultSpawn;
  const which = opts.which ?? ((bin: string) => Bun.which(bin));
  const runs = new Map<string, AgentRun>();
  const processes = new Map<string, AgentProcess>();

  const collect = async (run: AgentRun, stream: ReadableStream<Uint8Array>) => {
    const decoder = new TextDecoder();
    let rest = "";
    for await (const chunk of stream) {
      const lines = (rest + decoder.decode(chunk, { stream: true })).split("\n");
      rest = lines.pop() ?? "";
      run.output.push(...lines);
      if (run.output.length > MAX_LINES) run.output.splice(0, run.output.length - MAX_LINES);
    }
    if (rest) run.output.push(rest);
  };

  const commands = new Map<string, string[]>();
  const busy = (cwd: string) => [...runs.values()].some((r) => r.status === "running" && r.cwd === cwd);

  /** Starts a run; when it ends, the next one queued for the same checkout starts. */
  const start = (run: AgentRun) => {
    const argv = commands.get(run.id)!;
    commands.delete(run.id);
    run.status = "running";
    run.startedAt = new Date().toISOString();
    let proc: AgentProcess;
    try {
      proc = spawn(argv, run.cwd);
    } catch (e) {
      run.status = "failed";
      run.endedAt = new Date().toISOString();
      run.output.push(`No se pudo iniciar el agente: ${(e as Error).message}`);
      startNext(run.cwd);
      return;
    }
    processes.set(run.id, proc);
    const outputs = Promise.all([collect(run, proc.stdout), collect(run, proc.stderr)]).catch(() => {});
    void proc.exited.then(async (code) => {
      await outputs;
      processes.delete(run.id);
      run.exitCode = code;
      run.endedAt = new Date().toISOString();
      if (run.status === "running") run.status = code === 0 ? "done" : "failed";
      startNext(run.cwd);
    });
  };
  const startNext = (cwd: string) => {
    const next = [...runs.values()].find((r) => r.status === "queued" && r.cwd === cwd);
    if (next && !busy(cwd)) start(next);
  };

  /**
   * The tasks as the agent gets them, checked: a whole requirement only while none of its criteria
   * is done, and only criteria not done yet (each from its own requirement).
   */
  const taskItems = async (projectId: string, snap: Awaited<ReturnType<Tracker["snapshot"]>>, asked: { requirementId: string; dodIds?: string[] }[]) => {
    const items: LaunchItem[] = [];
    for (const a of asked) {
      const requirement = await tracker.resolveRequirement(projectId, a.requirementId);
      const name = requirement.code ?? requirement.title;
      const dod = snap.dod.filter((d) => d.requirementId === requirement.id);
      if (!a.dodIds?.length) {
        if (!requirementImplementable(dod)) {
          throw new HTTPException(409, { message: `${name} ya tiene criterios cumplidos: elige sus criterios pendientes en lugar del requerimiento completo` });
        }
        items.push({ requirement, criteria: dod.map(({ id, criterion }) => ({ id, criterion })), onlyCriteria: false });
        continue;
      }
      const criteria = a.dodIds.map((id) => {
        const d = dod.find((x) => x.id === id);
        if (!d) throw new HTTPException(404, { message: `Criterio no encontrado en ${name}: ${id}` });
        if (!dodImplementable(d)) throw new HTTPException(409, { message: `Ese criterio de ${name} ya está cumplido: «${d.criterion}»` });
        return { id: d.id, criterion: d.criterion };
      });
      items.push({ requirement, criteria, onlyCriteria: true });
    }
    return items;
  };

  app.get("/projects/:id/runs", async (c) => {
    const projectId = c.req.param("id");
    await tracker.projectOr404(projectId);
    return c.json([...runs.values()].filter((r) => r.projectId === projectId).reverse());
  });

  app.post("/projects/:id/runs", async (c) => {
    localOnly(c);
    const projectId = c.req.param("id");
    const parsed = launchInput.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new HTTPException(400, { message: z.prettifyError(parsed.error) });
    const input = parsed.data;
    const snap = await tracker.snapshot(projectId);
    const root = snap.project.repoPath;
    if (!root) throw new HTTPException(409, { message: "El proyecto no tiene repositorio local donde trabajar" });
    const items = await taskItems(projectId, snap, input.items);
    // Only the project's own checkouts: never an arbitrary folder.
    const checkouts = await listWorktrees(root).catch(() => [{ path: root }]);
    const cwd = input.cwd ? resolve(input.cwd) : root;
    if (!checkouts.some((w) => resolve(w.path) === cwd)) throw new HTTPException(400, { message: "Elige el checkout principal o un worktree del proyecto" });
    if (!which(LAUNCH_BINARIES[input.agent])) throw new HTTPException(409, { message: `${input.agent} no está instalado en este equipo` });

    const prompt = launchPrompt({ project: snap.project.name, items, instructions: input.instructions });
    const run: AgentRun = {
      id: crypto.randomUUID(),
      projectId,
      tasks: items.map((i, n) => ({
        requirementId: (i.requirement as unknown as { id: string }).id,
        code: i.requirement.code ?? null,
        title: i.requirement.title,
        criteria: i.onlyCriteria ? i.criteria.length : null,
      })),
      label: launchLabel(items),
      agent: input.agent,
      cwd,
      permission: input.permission,
      status: "queued",
      createdAt: new Date().toISOString(),
      startedAt: null,
      endedAt: null,
      exitCode: null,
      output: [],
    };
    runs.set(run.id, run);
    commands.set(run.id, launchCommand(input.agent, prompt, input.permission, input.model));
    // One agent per checkout: the rest wait their turn.
    if (!busy(cwd)) start(run);
    await tracker.recordEvent(projectId, "user:local", "agent_launched", { runId: run.id, agent: run.agent, tasks: run.label, permission: run.permission, queued: run.status === "queued" });
    return c.json(run, 201);
  });

  app.post("/projects/:id/runs/:runId/stop", async (c) => {
    localOnly(c);
    const { id: projectId, runId } = c.req.param();
    const run = runs.get(runId);
    if (!run || run.projectId !== projectId) throw new HTTPException(404, { message: "Trabajo no encontrado" });
    if (run.status === "queued") {
      run.status = "stopped";
      run.endedAt = new Date().toISOString();
      commands.delete(runId);
    }
    const proc = processes.get(runId);
    if (proc && run.status === "running") {
      run.status = "stopped";
      proc.kill();
    }
    return c.json(run);
  });

  return app;
}
