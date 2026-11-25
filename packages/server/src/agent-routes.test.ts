import { openDb } from "@agent-tracking/db";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";

let home: string;
let app: ReturnType<typeof createApp>;
const req = async (method: string, path: string, json?: unknown, headers: Record<string, string> = {}) => {
  const res = await app.request(`http://127.0.0.1:4317/api${path}`, {
    method,
    headers: { ...(json ? { "Content-Type": "application/json" } : {}), ...headers },
    body: json ? JSON.stringify(json) : undefined,
  });
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
};

beforeAll(async () => {
  home = await mkdtemp(join(tmpdir(), "at-agents-home-"));
  process.env.AGENT_TRACKING_HOME = home;
  await mkdir(join(home, ".gemini"));
  app = createApp(openDb(":memory:"), { claudeHome: join(home, ".claude") });
});
afterAll(async () => {
  delete process.env.AGENT_TRACKING_HOME;
  await rm(home, { recursive: true, force: true });
});

describe("agent routes", () => {
  test("lists agents with their status", async () => {
    const { data } = await req("GET", "/agents");
    expect(data.map((a: any) => a.kind)).toEqual(["claude-code", "codex", "gemini-cli"]);
    expect(data.find((a: any) => a.kind === "gemini-cli")).toMatchObject({ installed: true, mcp: false, hooks: false, contextFile: "GEMINI.md" });
  });

  test("connects only what was shown, only from this machine", async () => {
    const plan = (await req("GET", "/agents/gemini-cli/connect-plan")).data;
    expect(plan[0].after).toContain("http://127.0.0.1:4317/api/agent/hook?agent=gemini-cli");
    expect((await req("POST", "/agents/gemini-cli/connect", { plan }, { Origin: "https://evil.example" })).status).toBe(403);
    expect((await req("POST", "/agents/gemini-cli/connect", { plan: [] })).status).toBe(409);
    const ok = await req("POST", "/agents/gemini-cli/connect", { plan }, { Origin: "http://127.0.0.1:4317" });
    expect(ok).toMatchObject({ status: 200, data: { status: { mcp: true, hooks: true } } });
    expect(await readFile(join(home, ".gemini/settings.json"), "utf8")).toContain("agent-tracking");

    const undo = (await req("GET", "/agents/gemini-cli/disconnect-plan")).data;
    expect((await req("POST", "/agents/gemini-cli/disconnect", { plan: undo })).data.status).toMatchObject({ mcp: false, hooks: false });
    expect((await req("GET", "/agents/otro/connect-plan")).status).toBe(404);
  });
});
