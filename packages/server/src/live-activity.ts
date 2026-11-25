import { isAbsolute, relative } from "node:path";

/**
 * What an agent is doing right now, fed by Claude Code hooks (UserPromptSubmit, PreToolUse, Stop).
 * Kept in memory only: it is a live view, not history. The final report is what gets stored.
 */
export type LiveStep = { at: string; tool: string; label: string; target?: string };
export type LiveState = {
  status: "working" | "idle";
  startedAt: string | null;
  lastAt: string | null;
  steps: LiveStep[];
};

/** The subset of a Claude Code hook payload this module reads. Everything else is ignored. */
export type HookPayload = {
  hook_event_name?: string;
  session_id?: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
};

const MAX_STEPS = 30;
const MAX_TARGET = 100;
/** A turn with no news for this long is treated as finished (a Stop hook can be missed). */
export const IDLE_AFTER_MS = 2 * 60_000;

const LABELS: Record<string, string> = {
  Read: "Lee",
  Write: "Escribe",
  Edit: "Edita",
  MultiEdit: "Edita",
  NotebookEdit: "Edita",
  Bash: "Ejecuta",
  Grep: "Busca",
  Glob: "Busca archivos",
  WebFetch: "Consulta",
  WebSearch: "Busca en la web",
  Task: "Delega",
  Agent: "Delega",
  TodoWrite: "Actualiza su lista de tareas",
};

const clip = (text: string) => {
  const line = text.split("\n")[0]!.trim();
  return line.length > MAX_TARGET ? `${line.slice(0, MAX_TARGET - 1)}…` : line;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);

/** Paths inside the repository are shown relative to it. */
const displayPath = (path: string, root: string | null) => {
  if (!root || !isAbsolute(path)) return path;
  const rel = relative(root, path);
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : path;
};

/** One readable line per tool call. File contents and long commands are never kept. */
export function describeTool(tool: string, input: Record<string, unknown> = {}, root: string | null = null): LiveStep {
  const at = new Date().toISOString();
  const mcp = /^mcp__(.+?)__(.+)$/.exec(tool);
  if (mcp) {
    const [, server, name] = mcp;
    return { at, tool, label: server === "agent-tracking" ? "Agent Tracking" : `MCP ${server}`, target: name!.replaceAll("_", " ") };
  }
  const path = str(input.file_path) ?? str(input.notebook_path) ?? str(input.path);
  const target =
    tool === "Bash"
      ? str(input.description) ?? str(input.command)
      : tool === "Grep" || tool === "Glob"
        ? str(input.pattern)
        : tool === "WebFetch"
          ? str(input.url)
          : tool === "WebSearch"
            ? str(input.query)
            : tool === "Task" || tool === "Agent"
              ? str(input.description)
              : path && displayPath(path, root);
  return { at, tool, label: LABELS[tool] ?? tool, ...(target ? { target: clip(target) } : {}) };
}

const idle = (): LiveState => ({ status: "idle", startedAt: null, lastAt: null, steps: [] });

export function createLiveActivity(opts: { idleAfterMs?: number; now?: () => number } = {}) {
  const idleAfter = opts.idleAfterMs ?? IDLE_AFTER_MS;
  const now = opts.now ?? Date.now;
  const states = new Map<string, LiveState>();

  const view = (projectId: string): LiveState => {
    const state = states.get(projectId);
    if (!state) return idle();
    const stale = state.status === "working" && state.lastAt && now() - Date.parse(state.lastAt) > idleAfter;
    return stale ? { ...state, status: "idle" } : state;
  };

  return {
    get: view,

    /** Applies one hook event. Returns false when it says nothing worth showing. */
    record(projectId: string, payload: HookPayload, repoRoot: string | null = null): boolean {
      const at = new Date(now()).toISOString();
      const current = view(projectId);
      switch (payload.hook_event_name) {
        case "UserPromptSubmit":
          // A message sent while the agent is still working joins the same turn and keeps its steps.
          if (current.status === "working") {
            states.set(projectId, { ...current, lastAt: at });
            return true;
          }
          // A new request: start a fresh list. The prompt text itself is not kept here.
          states.set(projectId, { status: "working", startedAt: at, lastAt: at, steps: [] });
          return true;
        case "PreToolUse": {
          if (!payload.tool_name) return false;
          const step = { ...describeTool(payload.tool_name, payload.tool_input, repoRoot), at };
          const fresh = current.status !== "working";
          states.set(projectId, {
            status: "working",
            startedAt: fresh ? at : current.startedAt,
            lastAt: at,
            steps: [step, ...(fresh ? [] : current.steps)].slice(0, MAX_STEPS),
          });
          return true;
        }
        case "Stop":
        case "SessionEnd":
          if (current.status !== "working") return false;
          states.set(projectId, { ...current, status: "idle", lastAt: at });
          return true;
        default:
          return false;
      }
    },

    forget(projectId: string) {
      states.delete(projectId);
    },
  };
}

export type LiveActivity = ReturnType<typeof createLiveActivity>;
