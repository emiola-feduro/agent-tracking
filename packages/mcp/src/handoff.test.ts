import { describe, expect, test } from "bun:test";
import { buildHandoff, type HandoffTurn } from "./handoff";

const snap = {
  requirements: [
    { id: "r1", code: "RF1", title: "Checkout" },
    { id: "r2", code: "RF2", title: "Catálogo" },
  ],
  dod: [
    { id: "d1", requirementId: "r1", criterion: "Paga con tarjeta", status: "done" },
    { id: "d2", requirementId: "r1", criterion: "Paga con transferencia", status: "pending" },
    { id: "d3", requirementId: "r2", criterion: "Filtra por precio", status: "failed" },
  ],
} as never;

const turn = (over: Partial<HandoffTurn>): HandoffTurn => ({
  agent: "claude-code",
  branch: "main",
  prompt: "",
  summary: "",
  files: [],
  startedAt: "2026-11-01T10:00:00.000Z",
  endedAt: "2026-11-01T10:10:00.000Z",
  ...over,
});

describe("buildHandoff", () => {
  test("takes the last finished turn and skips the one still open", () => {
    const h = buildHandoff(
      snap,
      [
        turn({ agent: "codex", branch: "feat/abierto", startedAt: "2026-11-02T09:00:00.000Z", endedAt: null }),
        turn({ agent: "gemini-cli", branch: "feat/pagos", prompt: "Agrega pagos", summary: "Hice pagos", endedAt: "2026-11-01T12:00:00.000Z", files: [{ path: "a.ts", insertions: 3, deletions: 1, binary: false } as never] }),
        turn({ agent: "claude-code", endedAt: "2026-11-01T11:00:00.000Z" }),
      ],
      [],
    );
    expect(h.lastTurn).toMatchObject({ agent: "gemini-cli", branch: "feat/pagos", request: "Agrega pagos", summary: "Hice pagos" });
    expect(h.lastTurn!.files).toEqual([{ path: "a.ts", insertions: 3, deletions: 1 }]);
  });

  test("lists pending and failed criteria by requirement, optionally for one requirement", () => {
    const all = buildHandoff(snap, [], []);
    expect(all.lastTurn).toBeNull();
    expect(all.pendingDod.map((r) => [r.code, r.pending.map((d) => d.id)])).toEqual([
      ["RF1", ["d2"]],
      ["RF2", ["d3"]],
    ]);
    expect(buildHandoff(snap, [], [], "r2").pendingDod.map((r) => r.code)).toEqual(["RF2"]);
  });

  test("points to the changes left to report", () => {
    const h = buildHandoff(snap, [], [{ path: "b.ts", changedAt: "2026-11-01T00:00:00.000Z", reportedAt: null, symbols: 2 }]);
    expect(h.pendingChanges.map((p) => p.path)).toEqual(["b.ts"]);
    expect(h.next).toContain("1 archivo(s) cambiados sin reportar");
  });
});
