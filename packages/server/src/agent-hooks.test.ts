import { openDb } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { createRepoInference, createTracker } from "@agent-tracking/tracking";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";
import { createLiveActivity } from "./live-activity";

let tmp: string;
let repo: string;
let app: ReturnType<typeof createApp>;
let projectId: string;

const call = async (method: string, path: string, json?: unknown) => {
  const res = await app.request(`/api${path}`, {
    method,
    headers: json ? { "Content-Type": "application/json" } : {},
    body: json ? JSON.stringify(json) : undefined,
  });
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
};
const codex = (payload: object) => call("POST", "/agent/hook?agent=codex&v=2", { cwd: repo, session_id: "cx1", ...payload });

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-hooks-"));
  repo = join(tmp, "repo");
  await git(["init", "-q", "-b", "main", repo]);
  await git(["config", "user.email", "t@t"], repo);
  await git(["config", "user.name", "t"], repo);
  await writeFile(join(repo, "app.ts"), "export const a = 1;\n");
  await git(["add", "."], repo);
  await git(["commit", "-qm", "init"], repo);
  const db = openDb(":memory:");
  const tracker = createTracker(db);
  const inference = createRepoInference(db, tracker);
  app = createApp(db, {
    tracker,
    live: createLiveActivity(),
    claudeHome: join(tmp, "claude"),
    syncRepo: (id, scope) => (scope === "all" ? inference.syncAll(id) : inference.syncWorkingTree(id)),
  });
  const created = await call("POST", "/projects", { name: "Gastos", kind: "api", repoPath: repo, requirements: [{ title: "Registrar gastos" }] });
  projectId = created.data.project.id;
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

describe("agent hooks", () => {
  test("a git command that would delete main is denied with the reason; others pass", async () => {
    const denied = await codex({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git branch -D main" } });
    expect(denied.status).toBe(200);
    expect(denied.data.hookSpecificOutput).toMatchObject({ hookEventName: "PreToolUse", permissionDecision: "deny" });
    expect(denied.data.hookSpecificOutput.permissionDecisionReason).toContain("main");
    // Claude Code speaks the same protocol.
    const claude = await call("POST", "/agent/hook", { cwd: repo, session_id: "c1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git push --force origin main" } });
    expect(claude.data.hookSpecificOutput.permissionDecision).toBe("deny");
    const fine = await codex({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git switch -c feat/total" } });
    expect(fine.status).toBe(204);
  });

  test("the first prompt of an agent adds it to the project and writes its instruction file with the git rules", async () => {
    await codex({ hook_event_name: "UserPromptSubmit", prompt: "Agrega el total" });
    expect((await call("GET", `/projects/${projectId}`)).data.project.agents).toContain("codex");
    const agents = await readFile(join(repo, "AGENTS.md"), "utf8");
    expect(agents).toContain("submit_report");
    expect(agents).toContain("Nunca borres");
    // New projects ask agents to talk to the person in Spanish.
    expect(agents).toContain("Háblale al usuario en español");
  });

  test("each new request reminds the reply language, and a change applies at once", async () => {
    const prompt = await codex({ hook_event_name: "UserPromptSubmit", prompt: "Sigue" });
    expect(prompt.status).toBe(200);
    expect(prompt.data.hookSpecificOutput).toMatchObject({ hookEventName: "UserPromptSubmit" });
    expect(prompt.data.hookSpecificOutput.additionalContext).toContain("español");

    expect((await call("PATCH", `/projects/${projectId}`, { replyLanguage: "en" })).status).toBe(200);
    const english = await call("POST", "/agent/hook", { cwd: repo, session_id: "c2", hook_event_name: "UserPromptSubmit", prompt: "Go on" });
    expect(english.data.hookSpecificOutput.additionalContext).toContain("inglés (English)");
    expect(await readFile(join(repo, "AGENTS.md"), "utf8")).toContain("inglés (English)");
    expect(await readFile(join(repo, ".agent-tracking", "CONTEXT.md"), "utf8")).toContain("## Idioma con el usuario");

    expect((await call("PATCH", `/projects/${projectId}`, { replyLanguage: null })).status).toBe(200);
    expect((await codex({ hook_event_name: "UserPromptSubmit", prompt: "Sigue" })).status).toBe(204);
    expect(await readFile(join(repo, "AGENTS.md"), "utf8")).not.toContain("Háblale al usuario");
    expect((await call("PATCH", `/projects/${projectId}`, { replyLanguage: "es" })).status).toBe(200);
  });

  test("Codex edits show the patched files in the live view", async () => {
    const patch = "*** Begin Patch\n*** Add File: src/total.ts\n+export const total = 0;\n*** End Patch";
    await codex({ hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: { command: patch } });
    const live = (await call("GET", `/projects/${projectId}/live`)).data;
    const session = live.sessions.find((x: any) => x.agent === "codex");
    expect(session.steps[0]).toMatchObject({ label: "Edita", target: "src/total.ts" });
  });

  test("finishing with unreported changes asks once for submit_report", async () => {
    await writeFile(join(repo, "total.ts"), "export const total = 0;\n");
    const stop = await codex({ hook_event_name: "Stop", last_assistant_message: "Listo" });
    expect(stop.status).toBe(200);
    expect(stop.data.decision).toBe("block");
    expect(stop.data.reason).toContain("submit_report");
    expect(stop.data.reason).toContain("total.ts");
    // The agent is already continuing because of the hook: never block twice.
    const again = await codex({ hook_event_name: "Stop", stop_hook_active: true, last_assistant_message: "Listo" });
    expect(again.status).toBe(204);
  });
});
