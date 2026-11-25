import { openDb } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";

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
const hook = (agent: string, payload: object) => call("POST", `/agent/hook?agent=${agent}`, { cwd: repo, ...payload });

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-agents-"));
  repo = join(tmp, "repo");
  await git(["init", "-q", "-b", "main", repo]);
  await git(["config", "user.email", "t@t"], repo);
  await git(["config", "user.name", "t"], repo);
  await writeFile(join(repo, "a.ts"), "1\n");
  await git(["add", "."], repo);
  await git(["commit", "-qm", "init"], repo);
  app = createApp(openDb(":memory:"), { claudeHome: join(tmp, "claude") });
  projectId = (await call("POST", "/projects", { name: "R", kind: "cli", repoPath: repo })).data.project.id;
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

describe("several agents", () => {
  test("Codex and Gemini work at the same time: two live sessions, two summarized turns", async () => {
    await hook("codex", { hook_event_name: "UserPromptSubmit", session_id: "c1", prompt: "Codex: agrega b" });
    await hook("gemini-cli", { hook_event_name: "BeforeAgent", session_id: "g1", prompt: "Gemini: agrega c" });
    await hook("codex", { hook_event_name: "PreToolUse", session_id: "c1", tool_name: "apply_patch", tool_input: { input: "*** Add File: b.ts\n+b" } });
    await hook("gemini-cli", { hook_event_name: "BeforeTool", session_id: "g1", tool_name: "write_file", tool_input: { file_path: join(repo, "c.ts"), content: "c" } });

    const live = (await call("GET", `/projects/${projectId}/live`)).data;
    expect(live.status).toBe("working");
    expect(live.sessions.map((s: any) => [s.agent, s.steps[0].label, s.steps[0].target]).sort()).toEqual([
      ["codex", "Edita", "b.ts"],
      ["gemini-cli", "Escribe", "c.ts"],
    ]);

    await writeFile(join(repo, "b.ts"), "b\n");
    await hook("codex", { hook_event_name: "Stop", session_id: "c1", last_assistant_message: "Agregué b.ts." });
    await Bun.sleep(200);
    await writeFile(join(repo, "c.ts"), "c\n");
    await hook("gemini-cli", { hook_event_name: "AfterAgent", session_id: "g1", prompt_response: "Agregué c.ts." });
    await Bun.sleep(300);

    const turns = (await call("GET", `/projects/${projectId}/turns`)).data;
    const byAgent = Object.fromEntries(turns.map((t: any) => [t.agent, t]));
    expect(byAgent.codex).toMatchObject({ prompt: "Codex: agrega b", summary: "Agregué b.ts." });
    expect(byAgent.codex.files.map((f: any) => f.path)).toContain("b.ts");
    expect(byAgent["gemini-cli"]).toMatchObject({ prompt: "Gemini: agrega c", summary: "Agregué c.ts." });
    expect(byAgent["gemini-cli"].files.map((f: any) => f.path)).toContain("c.ts");
  });

  test("an unknown agent is ignored quietly", async () => {
    expect((await hook("otro", { hook_event_name: "UserPromptSubmit", prompt: "x" })).status).toBe(204);
  });
});
