import { schema as s, type Db } from "@agent-tracking/db";
import { currentBranch, diffSince, snapshotWorkingTree } from "@agent-tracking/git";
import { and, desc, eq, isNull } from "drizzle-orm";
import { open } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { HookPayload, LiveStep } from "./live-activity";

const MAX_PROMPT = 2_000;
const MAX_SUMMARY = 8_000;
/** Only the end of a transcript is read: the last answer is there. */
const TRANSCRIPT_TAIL = 512 * 1024;

export type TurnHookPayload = HookPayload & { prompt?: string; transcript_path?: string; last_assistant_message?: string };

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * The agent's final answer for the turn, read from the end of its transcript (a JSONL file that
 * Claude Code keeps under ~/.claude/projects). Paths outside `claudeHome` are never read.
 */
export async function lastAssistantMessage(transcriptPath: string | undefined, claudeHome: string): Promise<string> {
  if (!transcriptPath || !isAbsolute(transcriptPath) || !transcriptPath.endsWith(".jsonl")) return "";
  const rel = relative(resolve(claudeHome), resolve(transcriptPath));
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return "";
  const file = await open(transcriptPath, "r").catch(() => null);
  if (!file) return "";
  try {
    const { size } = await file.stat();
    const start = Math.max(0, size - TRANSCRIPT_TAIL);
    const buffer = Buffer.alloc(size - start);
    await file.read(buffer, 0, buffer.length, start);
    const lines = buffer.toString("utf8").split("\n").reverse();
    for (const line of lines) {
      if (!line.includes('"assistant"')) continue;
      try {
        const entry = JSON.parse(line) as { type?: string; message?: { content?: unknown } };
        if (entry.type !== "assistant" || !Array.isArray(entry.message?.content)) continue;
        const text = (entry.message.content as { type?: string; text?: string }[])
          .filter((b) => b.type === "text" && b.text?.trim())
          .map((b) => b.text!.trim())
          .join("\n\n");
        if (text) return text;
      } catch {
        /* a line cut by the tail window */
      }
    }
    return "";
  } finally {
    await file.close();
  }
}

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
    const summary = payload.last_assistant_message?.trim() || (await lastAssistantMessage(payload.transcript_path, opts.claudeHome));
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

    async list(projectId: string, limit = 20) {
      return db
        .select({
          id: s.agentTurns.id,
          sessionId: s.agentTurns.sessionId,
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
