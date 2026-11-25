import { openDb } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";

let tmp: string;
let repo: string;
let app: ReturnType<typeof createApp>;
const call = async (method: string, path: string, json?: unknown) => {
  const res = await app.request(`/api${path}`, { method, headers: json ? { "Content-Type": "application/json" } : {}, body: json ? JSON.stringify(json) : undefined });
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
};
const read = (f: string) => readFile(join(repo, f), "utf8").catch(() => null);

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-agentfiles-"));
  repo = join(tmp, "repo");
  await git(["init", "-q", "-b", "main", repo]);
  await writeFile(join(repo, "AGENTS.md"), "# Guía del equipo\n\nUsa pnpm.\n");
  app = createApp(openDb(":memory:"), { claudeHome: join(tmp, "claude") });
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

describe("agent instruction files", () => {
  test("the chosen agents' files carry the block; the team's own text stays", async () => {
    const { data } = await call("POST", "/projects", { name: "R", kind: "cli", repoPath: repo, agents: ["codex", "gemini-cli"] });
    const agents = await read("AGENTS.md");
    expect(agents).toStartWith("# Guía del equipo\n\nUsa pnpm.\n\n<!-- agent-tracking:start");
    expect(agents).toContain("get_project_context");
    expect(await read("GEMINI.md")).toContain("submit_report");
    expect(await read("CLAUDE.md")).toBeNull();

    await call("PATCH", `/projects/${data.project.id}`, { agents: ["claude-code"] });
    expect(await read("AGENTS.md")).toBe("# Guía del equipo\n\nUsa pnpm.\n");
    expect(await read("GEMINI.md")).toBeNull();
    expect(await read("CLAUDE.md")).toContain("Agent Tracking");
    expect((await call("GET", `/projects/${data.project.id}`)).data.project.agents).toEqual(["claude-code"]);
  });
});
