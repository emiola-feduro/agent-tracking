#!/usr/bin/env bun
/**
 * Claude Code `Stop` hook: before the agent ends its turn, makes sure the work it did in a tracked
 * repository is in Agent Tracking. If files it changed are not covered by a report, the turn is
 * blocked once with an instruction to call `submit_report`.
 *
 *   bun packages/mcp/src/stop-hook.ts [--url <server>] [--db <file>]
 *
 * It never gets in the way: outside a tracked project, after a turn that changed nothing, on the
 * second attempt (`stop_hook_active`) or on any error it exits 0 without output.
 */
import { openDb } from "@agent-tracking/db";
import { createRepoInference, createTracker, type PendingFile } from "@agent-tracking/tracking";
import { parseArgs } from "node:util";

/** Tools that can change files. Bash is included: its effects are invisible to the transcript. */
export const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit", "Bash"]);
const REPORT_TOOL = /(^|__)submit_report$/;

export type HookInput = { cwd?: string; transcript_path?: string; stop_hook_active?: boolean };

type Entry = { type?: string; message?: { content?: unknown } };

const isToolResultTurn = (content: unknown) =>
  Array.isArray(content) && content.length > 0 && content.every((c) => (c as { type?: string })?.type === "tool_result");

/**
 * Reads the current turn of a transcript (JSONL) backwards, up to the person's last message.
 * Returns whether files may have changed after the last submit_report of the turn.
 */
export function turnChangedFiles(jsonl: string): boolean {
  const lines = jsonl.split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry: Entry;
    try {
      entry = JSON.parse(lines[i]!);
    } catch {
      continue;
    }
    const content = entry.message?.content;
    if (entry.type === "user" && !isToolResultTurn(content)) return false; // start of the turn
    if (entry.type !== "assistant" || !Array.isArray(content)) continue;
    // Newest first within the message too.
    for (const item of [...content].reverse()) {
      const { type, name } = item as { type?: string; name?: string };
      if (type !== "tool_use" || !name) continue;
      if (REPORT_TOOL.test(name)) return false; // reported after the last edit
      if (EDIT_TOOLS.has(name)) return true;
    }
  }
  return false;
}

export function blockMessage(pending: PendingFile[]) {
  const list = pending.slice(0, 15).map((p) => p.path);
  const more = pending.length > list.length ? ` y ${pending.length - list.length} más` : "";
  return (
    "Agent Tracking: antes de terminar, llama una vez a submit_report (servidor MCP agent-tracking) con lo que hiciste, " +
    "organizado por requerimiento y feature: archivos con su propósito, funciones o tipos relevantes, tests con resultado " +
    `y criterios del DoD cumplidos. Archivos cambiados sin reportar: ${list.join(", ")}${more}.`
  );
}

async function pendingFromServer(baseUrl: string, cwd: string): Promise<PendingFile[] | null> {
  try {
    const health = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
    if (!health.ok) return null;
  } catch {
    return null;
  }
  const res = await fetch(`${baseUrl}/api/report/pending?path=${encodeURIComponent(cwd)}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return [];
  const data = (await res.json()) as { projectId: string | null; pending: PendingFile[] };
  return data.projectId ? data.pending : [];
}

async function pendingFromDb(dbPath: string, cwd: string): Promise<PendingFile[]> {
  const db = openDb(dbPath);
  const tracker = createTracker(db);
  const projectId = await tracker.resolveProject(cwd);
  if (!projectId) return [];
  // No server means no watcher: analyse the working tree now.
  await createRepoInference(db, tracker).syncWorkingTree(projectId);
  return tracker.pendingChanges(projectId);
}

export async function decide(input: HookInput, opts: { baseUrl: string; dbPath?: string }): Promise<string | null> {
  if (input.stop_hook_active || !input.cwd) return null;
  // Without a readable transcript (headless runs without persistence) the pending files decide alone.
  const transcript = input.transcript_path ? await Bun.file(input.transcript_path).text().catch(() => "") : "";
  if (transcript && !turnChangedFiles(transcript)) return null;
  const pending = (await pendingFromServer(opts.baseUrl, input.cwd)) ?? (opts.dbPath ? await pendingFromDb(opts.dbPath, input.cwd) : []);
  return pending.length > 0 ? blockMessage(pending) : null;
}

if (import.meta.main) {
  try {
    const { values } = parseArgs({ options: { url: { type: "string" }, db: { type: "string" } } });
    const input = JSON.parse(await Bun.stdin.text()) as HookInput;
    const reason = await decide(input, {
      baseUrl: (values.url ?? process.env.AGENT_TRACKING_URL ?? "http://127.0.0.1:4317").replace(/\/+$/, ""),
      dbPath: values.db ?? process.env.AGENT_TRACKING_DB,
    });
    if (reason) process.stdout.write(JSON.stringify({ decision: "block", reason }));
  } catch {
    // A tracking hook must never stop the agent because of its own failure.
  }
  process.exit(0);
}
