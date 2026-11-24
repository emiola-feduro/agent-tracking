import { openDb, schema as s } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, type AppEvent } from "./app";
import { createLiveActivity, describeTool } from "./live-activity";

describe("describeTool", () => {
  test("one short line per tool, without file contents", () => {
    const root = "/repo";
    expect(describeTool("Write", { file_path: "/repo/src/a.ts", content: "secret body" }, root)).toMatchObject({ label: "Escribe", target: "src/a.ts" });
    expect(describeTool("Read", { file_path: "/etc/hosts" }, root)).toMatchObject({ label: "Lee", target: "/etc/hosts" });
    expect(describeTool("Bash", { command: "bun test", description: "Corre los tests" })).toMatchObject({ label: "Ejecuta", target: "Corre los tests" });
    expect(describeTool("Bash", { command: `echo ${"x".repeat(300)}\nsecond line` }).target!.length).toBeLessThanOrEqual(100);
    expect(describeTool("Grep", { pattern: "addItem" })).toMatchObject({ label: "Busca", target: "addItem" });
    expect(describeTool("mcp__agent-tracking__submit_report", {})).toMatchObject({ label: "Agent Tracking", target: "submit report" });
    expect(describeTool("SomethingNew", {})).toMatchObject({ label: "SomethingNew" });
    expect(JSON.stringify(describeTool("Write", { file_path: "/repo/a", content: "secret body" }))).not.toContain("secret");
  });
});

describe("live activity", () => {
  test("a turn starts working, collects steps and ends idle", () => {
    let clock = Date.parse("2026-11-24T10:00:00Z");
    const live = createLiveActivity({ now: () => clock, idleAfterMs: 60_000 });
    expect(live.get("p").status).toBe("idle");

    expect(live.record("p", { hook_event_name: "UserPromptSubmit" })).toBe(true);
    live.record("p", { hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "/r/a.ts" } }, "/r");
    clock += 1000;
    live.record("p", { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "/r/a.ts" } }, "/r");
    let state = live.get("p");
    expect(state.status).toBe("working");
    expect(state.steps.map((x) => x.label)).toEqual(["Edita", "Lee"]); // newest first
    expect(state.startedAt).toBe("2026-11-24T10:00:00.000Z");

    expect(live.record("p", { hook_event_name: "Stop" })).toBe(true);
    state = live.get("p");
    expect(state.status).toBe("idle");
    expect(state.steps).toHaveLength(2); // the last turn stays visible
    expect(live.record("p", { hook_event_name: "Stop" })).toBe(false);
    expect(live.record("p", { hook_event_name: "PostToolUse", tool_name: "Read" })).toBe(false);

    // A tool call after a finished turn starts a new list.
    live.record("p", { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" } });
    expect(live.get("p").steps).toHaveLength(1);
  });

  test("silence counts as finished, and the list is capped", () => {
    let clock = 0;
    const live = createLiveActivity({ now: () => clock, idleAfterMs: 60_000 });
    for (let i = 0; i < 40; i++) live.record("p", { hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: `/f${i}` } });
    expect(live.get("p").steps).toHaveLength(30);
    clock += 61_000;
    expect(live.get("p").status).toBe("idle");
  });
});

describe("hook endpoint", () => {
  let tmp: string;
  let repo: string;
  const events: AppEvent[] = [];
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    tmp = await mkdtemp(join(tmpdir(), "at-live-"));
    repo = join(tmp, "repo");
    await git(["init", "-q", "-b", "main", repo]);
    const db = openDb(":memory:");
    await db.insert(s.projects).values({ id: "p1", name: "Demo", platforms: ["web"], repoPath: repo });
    app = createApp(db, { emit: (e) => events.push(e), claudeHome: join(tmp, "claude") });
  });
  afterAll(() => rm(tmp, { recursive: true, force: true }));

  const post = (payload: unknown) =>
    app.request("/api/agent/hook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

  test("tool calls in a tracked repo show up live; the answer is always empty", async () => {
    const res = await post({ hook_event_name: "PreToolUse", cwd: repo, tool_name: "Write", tool_input: { file_path: join(repo, "src/a.ts"), content: "x" } });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(events.at(-1)).toEqual({ type: "live", projectId: "p1" });
    const state = await (await app.request("/api/projects/p1/live")).json();
    expect(state).toMatchObject({ status: "working", steps: [{ label: "Escribe", target: "src/a.ts" }] });
  });

  test("anything outside a tracked project, or malformed, is ignored quietly", async () => {
    const before = events.length;
    expect((await post({ hook_event_name: "PreToolUse", cwd: tmp, tool_name: "Read" })).status).toBe(204);
    expect((await post({ hook_event_name: "PreToolUse", cwd: "relativo", tool_name: "Read" })).status).toBe(204);
    expect((await app.request("/api/agent/hook", { method: "POST", body: "{nope" })).status).toBe(204);
    expect(events.length).toBe(before);
    expect((await app.request("/api/projects/nope/live")).status).toBe(404);
  });
});
