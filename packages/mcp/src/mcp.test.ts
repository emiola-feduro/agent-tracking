import { loadSnapshot, openDb, type Db } from "@agent-tracking/db";
import { schema as s } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { createTracker, readRepoFile, type AppEvent } from "@agent-tracking/tracking";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMcpHttpHandler } from "./http";
import { createMcpServer } from "./server";

let tmp: string;
let repo: string;
let db: Db;
const events: AppEvent[] = [];
const tracker = () => createTracker(db, { emit: (e) => events.push(e) });

const PROJECT = "p-tienda";
const REQ = "r-checkout";
const DOD = "d-tarjeta";

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-mcp-"));
  repo = join(tmp, "tienda");
  await git(["init", "-q", "-b", "main", repo]);
  db = openDb(":memory:");
  await db.insert(s.projects).values({ id: PROJECT, name: "Tienda", goal: "Vender", platforms: ["web"], repoPath: repo });
  await db.insert(s.businessRules).values({ id: "b1", projectId: PROJECT, text: "Todo pedido requiere login" });
  await db.insert(s.projectSkills).values([
    { id: "k1", projectId: PROJECT, name: "tdd", description: "Test first", source: "user", location: "/x/SKILL.md" },
    { id: "k2", projectId: PROJECT, name: "off", description: "x", source: "user", location: "/y", enabled: false },
  ]);
  await db.insert(s.requirements).values({ id: REQ, projectId: PROJECT, title: "Checkout" });
  await db.insert(s.dodItems).values({ id: DOD, requirementId: REQ, criterion: "Paga con tarjeta" });
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

const connect = async (session: Parameters<typeof createMcpServer>[1], name = "claude-code") => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createMcpServer(tracker(), session).connect(serverSide);
  const client = new Client({ name, version: "1.0.0" });
  await client.connect(clientSide);
  return client;
};

type ToolText = { content: { type: string; text: string }[]; isError?: boolean };
const call = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
  const res = (await client.callTool({ name, arguments: args })) as ToolText;
  const body = res.content[0]!.text;
  let data: any = body;
  try {
    data = JSON.parse(body);
  } catch {}
  return { data, isError: res.isError === true };
};

describe("MCP tools over an SDK client", () => {
  let client: Client;
  let featureId: string;

  beforeAll(async () => {
    // The agent's cwd is a subfolder of the repo: the project is found by path.
    client = await connect({ project: join(repo, "src") });
  });

  test("lists every tool", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        "complete_feature",
        "create_project",
        "get_plan_format",
        "get_project_context",
        "get_project_skills",
        "get_requirement",
        "list_requirements",
        "mark_dod_item",
        "pending_changes",
        "report_file",
        "report_screen",
        "report_symbol",
        "report_test",
        "submit_report",
        "start_feature",
        "suggest_test_idea",
      ].sort(),
    );
    expect(tools.find((t) => t.name === "report_symbol")!.inputSchema.properties).toHaveProperty("project");
  });

  test("prompts show up as /agent-tracking:start <requirement> and /agent-tracking:report", async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual(["report", "start"]);
    expect(prompts.find((p) => p.name === "start")!.arguments).toEqual([
      expect.objectContaining({ name: "requirement", required: true }),
    ]);

    // Run before mark_dod_item, so the criterion is still pending.
    const start = await client.getPrompt({ name: "start", arguments: { requirement: REQ } });
    const startText = (start.messages[0]!.content as { text: string }).text;
    expect(startText).toContain('"Checkout"');
    expect(startText).toContain(`get_requirement with "${REQ}"`);
    expect(startText).toContain(`- Paga con tarjeta (id ${DOD})`);
    expect(startText).toContain("git switch -c");

    // An unknown requirement still gives the workflow, without inventing criteria.
    const unknown = await client.getPrompt({ name: "start", arguments: { requirement: "RF99" } });
    const unknownText = (unknown.messages[0]!.content as { text: string }).text;
    expect(unknownText).toContain("Work on requirement RF99");
    expect(unknownText).not.toContain("Pending Definition of Done");

    const report = await client.getPrompt({ name: "report" });
    const reportText = (report.messages[0]!.content as { text: string }).text;
    expect(reportText).toContain("pending_changes");
    expect(reportText).toContain("submit_report ONCE");
  });

  test("report_screen adds a capture from the repo to the gallery and exports it for agents", async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    await Bun.write(join(repo, "shots/lista.png"), png);
    const ok = await call(client, "report_screen", { title: "Lista de gastos", route: "/gastos", imagePath: "shots/lista.png" });
    expect(ok.isError).toBe(false);
    const snap = await loadSnapshot(db, PROJECT);
    const screen = snap!.attachments.find((a) => a.id === ok.data.screenId)!;
    expect(screen).toMatchObject({ kind: "screen", title: "Lista de gastos", route: "/gastos", mime: "image/png" });
    const context = await readFile(join(repo, ".agent-tracking/CONTEXT.md"), "utf8");
    expect(context).toContain("## Vistas de la app");
    expect(await Bun.file(join(repo, ".agent-tracking/attachments", `${screen.id.slice(0, 8)}-lista.png`)).exists()).toBe(true);

    expect((await call(client, "report_screen", { title: "x", imagePath: "../fuera.png" })).isError).toBe(true);
    await Bun.write(join(repo, "notes.txt"), "hola");
    expect((await call(client, "report_screen", { title: "x", imagePath: "notes.txt" })).data).toContain("Solo se aceptan");
  });

  test("get_project_context returns CONTEXT.md resolved from the repo path", async () => {
    const { data, isError } = await call(client, "get_project_context");
    expect(isError).toBe(false);
    expect(data).toContain("# Tienda");
    expect(data).toContain("Todo pedido requiere login");
    expect(data).toContain(`(\`${DOD}\`)`);
  });

  test("get_project_skills returns only enabled skills", async () => {
    const { data } = await call(client, "get_project_skills");
    expect(data.map((k: { name: string }) => k.name)).toEqual(["tdd"]);
  });

  test("list_requirements includes DoD counts", async () => {
    const { data } = await call(client, "list_requirements");
    expect(data).toEqual([expect.objectContaining({ id: REQ, title: "Checkout", progress: 0, dod: { done: 0, total: 1 } })]);
  });

  test("start_feature creates the feature in progress, attributed to the agent", async () => {
    const { data } = await call(client, "start_feature", { requirementId: REQ, name: "Pago con tarjeta" });
    expect(data).toMatchObject({ status: "in_progress", created: true });
    featureId = data.featureId;
    const again = await call(client, "start_feature", { requirementId: REQ, name: "pago con TARJETA" });
    expect(again.data).toMatchObject({ featureId, created: false });
    const snap = (await loadSnapshot(db, PROJECT))!;
    expect(snap.features[0]).toMatchObject({ id: featureId, agent: "claude-code", status: "in_progress" });
  });

  test("report_file links a file to several features and normalizes its path", async () => {
    const other = await call(client, "start_feature", { requirementId: REQ, name: "Recibo por email" });
    const { data } = await call(client, "report_file", {
      path: join(repo, "src", "checkout", "pay.ts"),
      purpose: "Cobro con tarjeta",
      featureIds: [featureId, other.data.featureId],
    });
    expect(data.path).toBe("src/checkout/pay.ts");
    const snap = (await loadSnapshot(db, PROJECT))!;
    expect(snap.files).toEqual([expect.objectContaining({ path: "src/checkout/pay.ts", createdBy: "agent:claude-code" })]);
    expect(snap.featureFiles.filter((l) => l.fileId === data.fileId)).toHaveLength(2);
  });

  test("report_file rejects paths outside the repository", async () => {
    const { data, isError } = await call(client, "report_file", { path: "../fuera.ts" });
    expect(isError).toBe(true);
    expect(data).toContain("fuera del repositorio");
  });

  test("report_symbol upserts by file, name and kind", async () => {
    await call(client, "report_symbol", { path: "src/checkout/pay.ts", name: "charge", kind: "function", lineStart: 3 });
    await call(client, "report_symbol", {
      path: "src/checkout/pay.ts",
      name: "charge",
      kind: "function",
      lineStart: 4,
      lineEnd: 20,
      purpose: "Cobra el pedido",
    });
    await call(client, "report_symbol", { path: "src/checkout/types.ts", name: "Payment", kind: "type" });
    const snap = (await loadSnapshot(db, PROJECT))!;
    expect(snap.symbols.filter((y) => y.name === "charge")).toEqual([
      expect.objectContaining({ lineStart: 4, lineEnd: 20, purpose: "Cobra el pedido", source: "reported" }),
    ]);
    // The symbol's file did not exist yet: it gets registered.
    expect(snap.files.map((f) => f.path)).toContain("src/checkout/types.ts");
  });

  test("report_test upserts by path and name and inherits the requirement", async () => {
    await call(client, "report_test", { path: "src/checkout/pay.test.ts", name: "cobra", featureId, type: "unit", result: "failing" });
    const { data } = await call(client, "report_test", { path: "src/checkout/pay.test.ts", name: "cobra", result: "passing" });
    expect(data.lastResult).toBe("passing");
    const snap = (await loadSnapshot(db, PROJECT))!;
    expect(snap.tests).toEqual([expect.objectContaining({ featureId, requirementId: REQ, type: "unit", lastResult: "passing" })]);
  });

  test("mark_dod_item and complete_feature move the progress", async () => {
    const dod = await call(client, "mark_dod_item", { dodId: DOD, evidence: "src/checkout/pay.test.ts" });
    expect(dod.data).toEqual({ dodId: DOD, status: "done" });
    const done = await call(client, "complete_feature", { featureId, summary: "Listo" });
    expect(done.data).toEqual({ featureId, status: "done" });
    const list = await call(client, "list_requirements");
    expect(list.data[0].progress).toBe(100);
  });

  test("suggest_test_idea stores an LLM idea tied to the feature's requirement", async () => {
    await call(client, "suggest_test_idea", { text: "Tarjeta rechazada", featureId });
    const snap = (await loadSnapshot(db, PROJECT))!;
    expect(snap.testIdeas).toEqual([
      expect.objectContaining({ text: "Tarjeta rechazada", origin: "llm", status: "proposed", requirementId: REQ, featureId }),
    ]);
  });

  test("get_requirement returns features with their files and symbols", async () => {
    const { data } = await call(client, "get_requirement", { requirementId: REQ });
    const feature = data.features.find((f: { id: string }) => f.id === featureId);
    expect(feature.files).toEqual([
      expect.objectContaining({ path: "src/checkout/pay.ts", symbols: [expect.objectContaining({ name: "charge" })] }),
    ]);
    expect(data.dod[0]).toMatchObject({ status: "done", evidence: "src/checkout/pay.test.ts" });
    expect(data.testIdeas).toHaveLength(1);
  });

  test("every call is logged, emitted live and written to the repo", async () => {
    const log = await createTracker(db).listEvents(PROJECT, { limit: 200 });
    const types = new Set(log.map((e) => e.type));
    for (const t of ["get_project_context", "start_feature", "report_file", "report_symbol", "mark_dod_item", "suggest_test_idea"]) {
      expect(types.has(t)).toBe(true);
    }
    expect(log.every((e) => e.actor === "agent:claude-code")).toBe(true);
    expect(log.find((e) => e.type === "report_symbol")!.payload).toMatchObject({ path: expect.any(String), kind: expect.any(String) });
    expect(events.some((e) => e.type === "activity")).toBe(true);
    expect(events.some((e) => e.type === "changed" && e.entity === "symbol")).toBe(true);

    expect(JSON.parse(await readFile(join(repo, ".agent-tracking", "project.json"), "utf8")).version).toBe(2);
    const parsed = await readRepoFile(repo);
    if (!parsed?.ok) throw new Error("no project file");
    const file = parsed.file;
    const pay = file.files.find((f) => f.path === "src/checkout/pay.ts")!;
    expect(pay.featureIds).toContain(featureId);
    expect(await readFile(join(repo, ".agent-tracking", "files", "src", "checkout", "pay.ts.json"), "utf8")).toContain("Cobro con tarjeta");
    expect(pay.symbols[0].name).toBe("charge");
    expect(file.testIdeas[0].text).toBe("Tarjeta rechazada");
    const context = await readFile(join(repo, ".agent-tracking", "CONTEXT.md"), "utf8");
    expect(context).toContain("`src/checkout/pay.ts`: Cobro con tarjeta");
  });

  test("tools fail clearly when the project cannot be resolved", async () => {
    const lost = await connect({});
    const { data, isError } = await call(lost, "list_requirements");
    expect(isError).toBe(true);
    expect(data).toContain("pasa `project`");
    const byArg = await call(lost, "list_requirements", { project: PROJECT });
    expect(byArg.isError).toBe(false);
    const unknown = await call(lost, "list_requirements", { project: "/no/existe" });
    expect(unknown.data).toContain("No hay ningún proyecto");
  });
});

describe("Streamable HTTP transport", () => {
  test("serves the tools with a session per agent", async () => {
    const handler = createMcpHttpHandler(tracker());
    const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: handler });
    try {
      const client = new Client({ name: "cursor", version: "1" });
      await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.port}/mcp?project=${PROJECT}`)));
      const { data } = await call(client, "suggest_test_idea", { text: "Idea vía HTTP", requirementId: REQ });
      expect(data.ideaId).toBeString();
      const [last] = await createTracker(db).listEvents(PROJECT, { limit: 1 });
      expect(last).toMatchObject({ type: "suggest_test_idea", actor: "agent:cursor" });
      await client.close();

      const foreign = await fetch(`http://127.0.0.1:${server.port}/mcp`, {
        method: "POST",
        headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
        body: "{}",
      });
      expect(foreign.status).toBe(403);
    } finally {
      server.stop(true);
    }
  });

  test("a session forgotten by a server restart is revived, so the agent keeps working without reconnecting", async () => {
    const url = (port: number) => new URL(`http://127.0.0.1:${port}/mcp?project=${PROJECT}&agent=claude-code`);
    let server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: createMcpHttpHandler(tracker()) });
    const port = server.port as number;
    try {
      const client = new Client({ name: "claude-code", version: "1" });
      await client.connect(new StreamableHTTPClientTransport(url(port)));
      expect((await call(client, "list_requirements", {})).isError).toBe(false);

      // Same port, a fresh handler: every session is gone, as after an update.
      server.stop(true);
      server = Bun.serve({ port, hostname: "127.0.0.1", fetch: createMcpHttpHandler(tracker()) });
      const { isError, data } = await call(client, "suggest_test_idea", { text: "Tras reiniciar", requirementId: REQ });
      expect(isError).toBe(false);
      expect(data.ideaId).toBeString();
      const [last] = await createTracker(db).listEvents(PROJECT, { limit: 1 });
      expect(last).toMatchObject({ type: "suggest_test_idea", actor: "agent:claude-code" });
      await client.close();
    } finally {
      server.stop(true);
    }
  });
});

describe("stdio entrypoint", () => {
  test("runs against a database file when no server is reachable", async () => {
    const dbPath = join(tmp, "stdio.db");
    const fileDb = openDb(dbPath);
    await fileDb.insert(s.projects).values({ id: "p-stdio", name: "Stdio", platforms: ["web"], repoPath: repo });
    await fileDb.insert(s.requirements).values({ id: "r-stdio", projectId: "p-stdio", title: "Algo" });

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [join(import.meta.dir, "stdio.ts"), "--local", "--db", dbPath, "--project", "p-stdio", "--agent", "codex"],
      stderr: "pipe",
    });
    const client = new Client({ name: "test", version: "1" });
    await client.connect(transport);
    const { data } = await call(client, "start_feature", { requirementId: "r-stdio", name: "Desde stdio" });
    expect(data.created).toBe(true);
    await client.close();

    const snap = (await loadSnapshot(fileDb, "p-stdio"))!;
    expect(snap.features[0]).toMatchObject({ name: "Desde stdio", agent: "codex" });
  });
});

describe("creating a project from a plan", () => {
  test("asks for what is missing, then creates it with inferred classification", async () => {
    const client = await connect({});
    const fresh = join(tmp, "nuevo");
    await git(["init", "-q", "-b", "main", fresh]);
    const format = await call(client, "get_plan_format");
    expect(format.data).toContain("## Requerimientos");

    const partial = await call(client, "create_project", { plan: "# Agenda\n\n## Requerimientos\n\n### Ver citas del día\n- [ ] Lista ordenada por hora\n" });
    expect(partial.data.created).toBe(false);
    expect(partial.data.questions.map((q: { field: string }) => q.field)).toEqual(["kind", "goal"]);

    const done = await call(client, "create_project", {
      repoPath: fresh,
      plan: "# Agenda\nTipo: api\n\n## Objetivo\nCitas de un consultorio\n\n## Requerimientos\n\n### Ver citas del día\n- [ ] Lista ordenada por hora\n\n### Responde en menos de 100 ms\n",
    });
    expect(done.data.created).toBe(true);
    expect(done.data.followUp.map((q: { field: string }) => q.field)).toEqual(["dod"]);
    const snap = await loadSnapshot(db, done.data.projectId);
    expect(snap!.project).toMatchObject({ name: "Agenda", kind: "api", repoPath: fresh });
    expect(snap!.requirements.map((r) => [r.title, r.type, r.area])).toEqual([
      ["Ver citas del día", "functional", "backend"],
      ["Responde en menos de 100 ms", "non_functional", "performance"],
    ]);
    expect(snap!.dod.map((d) => d.criterion)).toEqual(["Lista ordenada por hora"]);
    expect((await call(client, "create_project", { repoPath: fresh, plan: "# X\nTipo: cli\n## Objetivo\ny\n## Requerimientos\n### Z\n- [ ] w\n" })).isError).toBe(true);
  });
});

describe("agents without hooks", () => {
  test("reading the context and reporting leaves a turn with the agent, the summary and the diff", async () => {
    await git(["config", "user.email", "t@t"], repo);
    await git(["config", "user.name", "t"], repo);
    await Bun.write(join(repo, "base.txt"), "base\n");
    await git(["add", "-A"], repo);
    await git(["commit", "-qm", "base"], repo);
    const client = await connect({ project: repo }, "codex-mcp-client");
    await call(client, "get_project_context");
    await Bun.write(join(repo, "nuevo-por-codex.ts"), "export const x = 1;\n");
    await call(client, "submit_report", { summary: "Agregué nuevo-por-codex.ts", features: [{ requirementId: REQ, name: "Algo de Codex" }] });
    const rows = db.select().from(s.agentTurns).all();
    const turn = rows.find((t) => t.agent === "codex")!;
    expect(turn).toMatchObject({ summary: "Agregué nuevo-por-codex.ts" });
    expect(turn.files.map((f) => f.path)).toContain("nuevo-por-codex.ts");
  });
});
