import { openDb, schema as s } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { createTracker } from "@agent-tracking/tracking";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { blockMessage, decide, turnChangedFiles } from "./stop-hook";

const line = (o: unknown) => JSON.stringify(o);
const user = (text: string) => line({ type: "user", message: { role: "user", content: text } });
const toolResult = () => line({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "x", content: "ok" }] } });
const toolUse = (name: string) => line({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "x", name, input: {} }] } });
const say = (text: string) => line({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text }] } });

describe("turnChangedFiles", () => {
  test("an edit in the current turn counts; earlier turns do not", () => {
    expect(turnChangedFiles([user("hola"), toolUse("Write"), toolResult(), say("listo")].join("\n"))).toBe(true);
    expect(turnChangedFiles([user("a"), toolUse("Edit"), toolResult(), user("¿y esto?"), say("respuesta")].join("\n"))).toBe(false);
    expect(turnChangedFiles([user("lee"), toolUse("Read"), toolResult(), say("ok")].join("\n"))).toBe(false);
  });

  test("a report after the last edit settles it, an edit after the report does not", () => {
    const reported = [user("haz"), toolUse("Edit"), toolResult(), toolUse("mcp__agent-tracking__submit_report"), toolResult(), say("hecho")];
    expect(turnChangedFiles(reported.join("\n"))).toBe(false);
    expect(turnChangedFiles([...reported.slice(0, 5), toolUse("Bash"), toolResult(), say("hecho")].join("\n"))).toBe(true);
  });

  test("tolerates broken lines", () => {
    expect(turnChangedFiles(["{nope", user("x"), toolUse("Write"), "", say("y")].join("\n"))).toBe(true);
  });
});

describe("decide", () => {
  let tmp: string;
  let repo: string;
  let dbPath: string;
  let transcript: string;
  const noServer = "http://127.0.0.1:9"; // nothing listens there

  beforeAll(async () => {
    tmp = await mkdtemp(join(tmpdir(), "at-hook-"));
    repo = join(tmp, "repo");
    await git(["init", "-q", "-b", "main", repo]);
    await mkdir(join(repo, "src"));
    dbPath = join(tmp, "at.db");
    const db = openDb(dbPath);
    await db.insert(s.projects).values({ id: "p1", name: "Demo", platforms: ["web"], repoPath: repo });
    await db.insert(s.requirements).values({ id: "r1", projectId: "p1", title: "Carrito" });
    transcript = join(tmp, "t.jsonl");
    await writeFile(transcript, [user("haz el carrito"), toolUse("Write"), toolResult(), say("listo")].join("\n"));
  });
  afterAll(() => rm(tmp, { recursive: true, force: true }));

  test("blocks once while changed files are unreported, then lets the agent finish", async () => {
    await writeFile(join(repo, "src/cart.ts"), "export function addItem() {}\n");
    const input = { cwd: repo, transcript_path: transcript };
    const reason = await decide(input, { baseUrl: noServer, dbPath });
    expect(reason).toContain("submit_report");
    expect(reason).toContain("src/cart.ts");
    // Second attempt in the same stop: never loop.
    expect(await decide({ ...input, stop_hook_active: true }, { baseUrl: noServer, dbPath })).toBeNull();

    await createTracker(openDb(dbPath)).submitReport("p1", "agent:test", {
      features: [{ requirementId: "r1", name: "Carrito", files: [{ path: "src/cart.ts", purpose: "Carrito" }] }],
    });
    expect(await decide(input, { baseUrl: noServer, dbPath })).toBeNull();
  });

  test("does nothing outside a tracked project or when the turn changed nothing", async () => {
    expect(await decide({ cwd: tmp, transcript_path: transcript }, { baseUrl: noServer, dbPath })).toBeNull();
    const quiet = join(tmp, "quiet.jsonl");
    await writeFile(quiet, [user("explícame"), say("claro")].join("\n"));
    await writeFile(join(repo, "src/other.ts"), "export const x = 1;\n");
    expect(await decide({ cwd: repo, transcript_path: quiet }, { baseUrl: noServer, dbPath })).toBeNull();
  });

  test("without a transcript, pending files decide", async () => {
    await writeFile(join(repo, "src/late.ts"), "export const late = 1;\n");
    const reason = await decide({ cwd: repo, transcript_path: join(tmp, "missing.jsonl") }, { baseUrl: noServer, dbPath });
    expect(reason).toContain("src/late.ts");
  });

  test("the message lists at most 15 files", () => {
    const pending = Array.from({ length: 20 }, (_, i) => ({ path: `f${i}.ts`, changedAt: "", reportedAt: null, symbols: 0 }));
    expect(blockMessage(pending)).toContain("y 5 más");
  });
});
