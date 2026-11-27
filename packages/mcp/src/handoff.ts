import type { ProjectSnapshot } from "@agent-tracking/core";

/** A turn as the turns store lists it (only what the handoff needs). */
export type HandoffTurn = {
  agent: string;
  branch: string | null;
  prompt: string;
  summary: string;
  files: { path: string; insertions: number; deletions: number }[];
  startedAt: string;
  endedAt: string | null;
};

export type HandoffPendingFile = { path: string; changedAt: string; reportedAt: string | null; symbols: number };

export type Handoff = {
  lastTurn: {
    agent: string;
    branch: string | null;
    request: string;
    summary: string;
    files: { path: string; insertions: number; deletions: number }[];
    startedAt: string;
    endedAt: string;
  } | null;
  pendingDod: {
    requirementId: string;
    code: string | null;
    title: string;
    pending: { id: string; criterion: string; status: string }[];
  }[];
  pendingChanges: HandoffPendingFile[];
  next: string;
};

/**
 * What a new session needs to pick up the work: the last finished turn (what it did, which agent,
 * on which branch), the Definition of Done criteria not done yet and the changed files no report covers.
 * `requirementId` (already resolved) narrows the pending criteria to one requirement.
 */
export function buildHandoff(
  snap: Pick<ProjectSnapshot, "requirements" | "dod">,
  turns: HandoffTurn[],
  pendingChanges: HandoffPendingFile[],
  requirementId?: string,
): Handoff {
  // Turns still open are in progress (possibly this very session): the last one that ended is the handoff.
  const last = turns
    .filter((t): t is HandoffTurn & { endedAt: string } => t.endedAt !== null)
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt))[0];

  const pendingDod = snap.requirements
    .filter((r) => !requirementId || r.id === requirementId)
    .map((r) => ({
      requirementId: r.id,
      code: r.code ?? null,
      title: r.title,
      pending: snap.dod
        .filter((d) => d.requirementId === r.id && d.status !== "done")
        .map(({ id, criterion, status }) => ({ id, criterion, status })),
    }))
    .filter((r) => r.pending.length > 0);

  const next: string[] = [];
  if (pendingChanges.length) next.push(`Hay ${pendingChanges.length} archivo(s) cambiados sin reportar: inclúyelos en submit_report.`);
  if (pendingDod.length) next.push("Sigue con los criterios del DoD pendientes; get_requirement da el detalle de cada requerimiento.");
  else next.push("No quedan criterios del DoD pendientes: pregúntale al usuario qué sigue.");

  return {
    lastTurn: last
      ? {
          agent: last.agent,
          branch: last.branch,
          request: last.prompt,
          summary: last.summary,
          files: last.files.map(({ path, insertions, deletions }) => ({ path, insertions, deletions })),
          startedAt: last.startedAt,
          endedAt: last.endedAt,
        }
      : null,
    pendingDod,
    pendingChanges,
    next: next.join(" "),
  };
}
