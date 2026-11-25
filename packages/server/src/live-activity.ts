import { AGENTS, type AgentEvent, type AgentKind } from "@agent-tracking/agents";
import { isAbsolute, relative } from "node:path";

/**
 * What agents are doing right now, fed by their hooks (Claude Code, Codex CLI, Gemini CLI; see
 * packages/agents). Kept in memory only: it is a live view, not history. Each agent session has its
 * own state, so two agents working on the same project show up side by side.
 */
export type LiveStep = { at: string; tool: string; label: string; target?: string };
export type LiveSession = {
  agent: AgentKind;
  sessionId: string;
  status: "working" | "idle";
  startedAt: string;
  lastAt: string;
  steps: LiveStep[];
};
/** The project's view: the most recent session's fields, plus every session still around. */
export type LiveState = {
  status: "working" | "idle";
  startedAt: string | null;
  lastAt: string | null;
  steps: LiveStep[];
  agent: AgentKind | null;
  sessions: LiveSession[];
};

const MAX_STEPS = 30;
/** A turn with no news for this long is treated as finished (a Stop hook can be missed). */
export const IDLE_AFTER_MS = 2 * 60_000;
/** Idle sessions are forgotten after this long. */
const FORGET_AFTER_MS = 6 * 60 * 60_000;

/** Paths inside the repository are shown relative to it. */
const displayPath = (path: string | undefined, root: string | null) => {
  if (!path || !root || !isAbsolute(path)) return path;
  const rel = relative(root, path);
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : path;
};

/** One readable line per tool call, from the agent's own adapter. File contents are never kept. */
export function describeTool(tool: string, input: Record<string, unknown> = {}, root: string | null = null, agent: AgentKind = "claude-code"): LiveStep {
  const { label, target } = AGENTS[agent].describeTool(tool, input);
  const shown = target && root ? target.split(", ").map((t) => displayPath(t, root)).join(", ") : target;
  return { at: new Date().toISOString(), tool, label, ...(shown ? { target: shown } : {}) };
}

const idle = (): LiveState => ({ status: "idle", startedAt: null, lastAt: null, steps: [], agent: null, sessions: [] });

export function createLiveActivity(opts: { idleAfterMs?: number; now?: () => number } = {}) {
  const idleAfter = opts.idleAfterMs ?? IDLE_AFTER_MS;
  const now = opts.now ?? Date.now;
  const projects = new Map<string, Map<string, LiveSession>>();

  const fresh = (s: LiveSession): LiveSession =>
    s.status === "working" && now() - Date.parse(s.lastAt) > idleAfter ? { ...s, status: "idle" } : s;

  const sessionsOf = (projectId: string) => {
    const map = projects.get(projectId);
    if (!map) return [];
    for (const [key, s] of map) if (now() - Date.parse(s.lastAt) > FORGET_AFTER_MS) map.delete(key);
    return [...map.values()].map(fresh).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  };

  const view = (projectId: string): LiveState => {
    const sessions = sessionsOf(projectId);
    const latest = sessions.find((s) => s.status === "working") ?? sessions[0];
    if (!latest) return idle();
    return {
      status: sessions.some((s) => s.status === "working") ? "working" : "idle",
      startedAt: latest.startedAt,
      lastAt: latest.lastAt,
      steps: latest.steps,
      agent: latest.agent,
      sessions,
    };
  };

  return {
    get: view,

    /** Applies one hook event. Returns false when it says nothing worth showing. */
    record(projectId: string, event: AgentEvent, repoRoot: string | null = null): boolean {
      const at = new Date(now()).toISOString();
      const key = `${event.agent}:${event.session_id ?? "sin-sesion"}`;
      let map = projects.get(projectId);
      if (!map) projects.set(projectId, (map = new Map()));
      const stored = map.get(key);
      const current = stored ? fresh(stored) : null;
      const working = current?.status === "working";
      const base = { agent: event.agent, sessionId: event.session_id ?? "sin-sesion" };
      switch (event.hook_event_name) {
        case "UserPromptSubmit":
          // A message sent while the agent is still working joins the same turn and keeps its steps.
          map.set(key, working ? { ...current!, lastAt: at } : { ...base, status: "working", startedAt: at, lastAt: at, steps: [] });
          return true;
        case "PreToolUse": {
          if (!event.tool_name) return false;
          const step = { ...describeTool(event.tool_name, event.tool_input, repoRoot, event.agent), at };
          map.set(key, {
            ...base,
            status: "working",
            startedAt: working ? current!.startedAt : at,
            lastAt: at,
            steps: [step, ...(working ? current!.steps : [])].slice(0, MAX_STEPS),
          });
          return true;
        }
        case "Stop":
        case "SessionEnd":
          if (!working) return false;
          map.set(key, { ...current!, status: "idle", lastAt: at });
          return true;
        default:
          return false;
      }
    },

    forget(projectId: string) {
      projects.delete(projectId);
    },
  };
}

export type LiveActivity = ReturnType<typeof createLiveActivity>;
