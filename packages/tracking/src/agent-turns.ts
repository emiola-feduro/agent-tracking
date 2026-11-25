import { schema as s, type Db } from "@agent-tracking/db";
import { currentBranch, diffSince, snapshotWorkingTree } from "@agent-tracking/git";
import { and, desc, eq, isNull } from "drizzle-orm";
import { claudeLastMessage, type AgentEvent } from "@agent-tracking/agents";

export type LiveStep = { at: string; tool: string; label: string; target?: string };

const MAX_PROMPT = 2_000;
const MAX_SUMMARY = 8_000;
/** A hook event as the turns see it (see packages/agents). */
export type TurnHookPayload = AgentEvent;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Kept for callers of the old name: Claude Code's last answer read from its transcript. */
export const lastAssistantMessage = claudeLastMessage;

/**
 * Records each agent turn that changed the repository: what was asked, the steps, the final answer
 * and the diff it left. Turns without changes (a question, an explanation) are dropped when they end.
 */
export function createAgentTurns(db: Db, opts: { claudeHome: string }) {
  const openTurn = (projectId: string, sessionId: string | null) =>
    db.query.agentTurns.findFirst({
      where: and(
        eq(s.agentTurns.projectId, projectId),
        isNull(s.agentTurns.endedAt),
        sessionId ? eq(s.agentTurns.sessionId, sessionId) : undefined,
      ),
      orderBy: desc(s.agentTurns.startedAt),
    });

  /** Prompts of sessions whose project is not known yet (cwd outside any repo), by session. */
  const pendingPrompts = new Map<string, { prompt: string; at: number }>();

  const start = async (projectId: string, payload: TurnHookPayload, checkout: string, prompt: string) => {
    const base = checkout ? await snapshotWorkingTree(checkout).catch(() => null) : null;
    await db.insert(s.agentTurns).values({
      id: crypto.randomUUID(),
      projectId,
      agent: payload.agent,
      sessionId: payload.session_id ?? null,
      cwd: checkout,
      branch: checkout ? await currentBranch(checkout).catch(() => null) : null,
      prompt: clip(prompt.trim(), MAX_PROMPT),
      baseCommit: base?.commit ?? null,
      baseUntracked: base?.untracked ?? [],
      startedAt: new Date().toISOString(),
    });
  };

  /**
   * Closes a turn with what it changed and the agent's last answer. A turn that changed nothing is
   * dropped: a question or an explanation does not deserve a summary.
   */
  const finish = async (turn: NonNullable<Awaited<ReturnType<typeof openTurn>>>, payload: TurnHookPayload, steps: LiveStep[]) => {
    const root = turn.cwd || payload.cwd || "";
    const diff =
      root && turn.baseCommit !== null ? await diffSince(root, { commit: turn.baseCommit, untracked: turn.baseUntracked }).catch(() => null) : null;
    if (!diff || diff.files.length === 0) {
      await db.delete(s.agentTurns).where(eq(s.agentTurns.id, turn.id));
      return false;
    }
    // Codex and Gemini send their last answer with the hook; Claude Code keeps it in its transcript.
    const summary =
      payload.last_assistant_message?.trim() ||
      (payload.agent === "claude-code" ? await claudeLastMessage(payload.transcript_path, opts.claudeHome) : "");
    await db
      .update(s.agentTurns)
      .set({
        endedAt: new Date().toISOString(),
        summary: clip(summary, MAX_SUMMARY),
        steps,
        files: diff.files,
        patch: diff.patch,
        patchTruncated: diff.truncated,
      })
      .where(eq(s.agentTurns.id, turn.id));
    return true;
  };

  return {
    /** Remembers the request of a session whose project shows up only later, through the files it touches. */
    rememberPrompt(payload: TurnHookPayload) {
      if (payload.hook_event_name === "UserPromptSubmit" && payload.session_id) {
        pendingPrompts.set(payload.session_id, { prompt: payload.prompt ?? "", at: Date.now() });
      }
    },

    /**
     * Applies one hook event to the project's turns. `ctx.wasWorking` says whether the agent was
     * still in the middle of a turn before this event (a message sent while it works is not a new turn).
     * Returns true when a turn started or ended (worth telling the UI).
     */
    async record(
      projectId: string,
      payload: TurnHookPayload,
      ctx: { checkout: string; wasWorking: boolean; steps: LiveStep[] },
    ): Promise<boolean> {
      const event = payload.hook_event_name;
      const sessionId = payload.session_id ?? null;
      const open = await openTurn(projectId, sessionId);

      if (event === "UserPromptSubmit") {
        if (open && ctx.wasWorking) {
          // Mid-turn message: same turn, its text is added to the request.
          const prompt = clip(`${open.prompt}\n\n${(payload.prompt ?? "").trim()}`.trim(), MAX_PROMPT);
          await db.update(s.agentTurns).set({ prompt }).where(eq(s.agentTurns.id, open.id));
          return false;
        }
        // A turn whose Stop never arrived is closed now, with its diff, before the new one starts.
        if (open) await finish(open, payload, ctx.steps);
        if (sessionId) pendingPrompts.delete(sessionId);
        await start(projectId, payload, ctx.checkout, payload.prompt ?? "");
        return true;
      }

      if (event === "PreToolUse") {
        // The session started outside the repo (or before the hooks existed): the turn starts now,
        // before this tool runs, so its own edits are part of the diff.
        if (open) return false;
        const pending = sessionId ? pendingPrompts.get(sessionId) : undefined;
        if (sessionId) pendingPrompts.delete(sessionId);
        await start(projectId, payload, ctx.checkout, pending?.prompt ?? "");
        return false;
      }

      if (event !== "Stop" && event !== "SessionEnd") return false;
      if (!open) return false;
      return finish(open, payload, ctx.steps);
    },

    /**
     * Turns for agents without hooks, seen only through MCP: reading the project context starts one
     * (unless a hook-tracked turn is already open in the project) and the final report closes it with
     * the report's summary and the diff since then.
     */
    async startFromMcp(projectId: string, input: { sessionId: string; agent: string; checkout: string }) {
      // Agents with hooks already have their turn open: do not count the same work twice. Other MCP-only
      // sessions do not block this one.
      const open = await db
        .select({ sessionId: s.agentTurns.sessionId, startedAt: s.agentTurns.startedAt })
        .from(s.agentTurns)
        .where(and(eq(s.agentTurns.projectId, projectId), isNull(s.agentTurns.endedAt)));
      const hooked = open.some((t) => !t.sessionId?.startsWith("mcp:") && Date.now() - Date.parse(t.startedAt) < 2 * 60 * 60_000);
      if (hooked || open.some((t) => t.sessionId === input.sessionId)) return false;
      await start(projectId, { agent: input.agent as AgentEvent["agent"], hook_event_name: "UserPromptSubmit", session_id: input.sessionId, cwd: input.checkout }, input.checkout, "");
      return true;
    },

    async finishFromMcp(projectId: string, input: { sessionId: string; summary: string; cwd: string }) {
      const turn = await openTurn(projectId, input.sessionId);
      if (!turn) return false;
      return finish(turn, { agent: turn.agent as AgentEvent["agent"], hook_event_name: "Stop", cwd: input.cwd, last_assistant_message: input.summary }, turn.steps);
    },

    async list(projectId: string, limit = 20) {
      return db
        .select({
          id: s.agentTurns.id,
          sessionId: s.agentTurns.sessionId,
          agent: s.agentTurns.agent,
          cwd: s.agentTurns.cwd,
          branch: s.agentTurns.branch,
          prompt: s.agentTurns.prompt,
          summary: s.agentTurns.summary,
          steps: s.agentTurns.steps,
          files: s.agentTurns.files,
          startedAt: s.agentTurns.startedAt,
          endedAt: s.agentTurns.endedAt,
        })
        .from(s.agentTurns)
        .where(eq(s.agentTurns.projectId, projectId))
        .orderBy(desc(s.agentTurns.startedAt))
        .limit(limit);
    },

    async get(projectId: string, turnId: string) {
      return db.query.agentTurns.findFirst({
        where: and(eq(s.agentTurns.projectId, projectId), eq(s.agentTurns.id, turnId)),
        columns: { baseCommit: false, baseUntracked: false },
      });
    },
  };
}

export type AgentTurns = ReturnType<typeof createAgentTurns>;
