import { mockAssistant, type MockReply, type MockRequest } from "@agent-tracking/assistant/src/testing";
import type { AssistantConfig } from "@agent-tracking/assistant";
import { recommendStack } from "@agent-tracking/core";
import { openDb } from "@agent-tracking/db";
import { describe, expect, test } from "bun:test";
import { createApp } from "./app";

const caller = (app: ReturnType<typeof createApp>) => async (method: string, path: string, json?: unknown) => {
  const res = await app.request(`/api${path}`, {
    method,
    headers: json ? { "Content-Type": "application/json" } : {},
    body: json ? JSON.stringify(json) : undefined,
  });
  return { status: res.status, data: (await res.json()) as any };
};

const setup = (reply?: (req: MockRequest) => MockReply) => {
  const mock = reply ? mockAssistant(reply) : null;
  const call = caller(createApp(openDb(":memory:"), { assistant: mock }));
  return { call, mock };
};

const project = { name: "Tienda", goal: "Vender en línea", platforms: ["web"], rules: ["Todo pedido requiere login"] };

describe("without an API key", () => {
  const { call } = setup();

  test("reports that the assistant is not configured", async () => {
    expect(await call("GET", "/assistant")).toEqual({ status: 200, data: { configured: false } });
  });

  test.each([
    ["/assistant/stack", project],
    ["/assistant/dod", { project, requirement: { title: "Checkout" } }],
    ["/assistant/skills", { project, skills: [] }],
  ])("POST %s answers 503 with the setup hint", async (path, payload) => {
    const { status, data } = await call("POST", path, payload);
    expect(status).toBe(503);
    expect(data.configured).toBe(false);
    expect(data.error).toContain("ANTHROPIC_API_KEY");
  });

  test("the deterministic recommendation keeps working", async () => {
    const { status, data } = await call("GET", "/stack/recommend?platforms=web");
    expect(status).toBe(200);
    expect(data).toEqual(recommendStack(["web"]));
  });
});

describe("choosing the provider", () => {
  const claude = mockAssistant(() => JSON.stringify({ criteria: ["De Claude"] }));
  /** An OpenAI provider whose fake fetch answers every request with the same criteria. */
  const openai = (): AssistantConfig => ({
    provider: "openai-api",
    http: {
      apiKey: "sk-o",
      baseUrl: "https://example.test",
      timeoutMs: 5_000,
      fetch: (async () =>
        Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ criteria: ["De OpenAI"] }) }] }] })) as unknown as typeof fetch,
    },
    models: { default: "gpt-6.2-sol", heavy: "gpt-6.2-astra" },
  });
  const setupBoth = () => {
    const other = openai();
    return caller(createApp(openDb(":memory:"), { assistant: claude, assistantProviders: [claude, other] }));
  };
  const dod = { project, requirement: { title: "Checkout" } };

  test("lists the available providers and the active one", async () => {
    const { status, data } = await setupBoth()("GET", "/assistant/providers");
    expect(status).toBe(200);
    expect(data.active).toBe("api");
    expect(data.providers.map((p: { id: string }) => p.id)).toEqual(["api", "openai-api"]);
    expect(data.providers[1]).toMatchObject({ label: "OpenAI (API key)", vendor: "OpenAI", models: { default: "gpt-6.2-sol" } });
  });

  test("switching sends the next requests through the chosen provider", async () => {
    const call = setupBoth();
    expect((await call("POST", "/assistant/dod", dod)).data.criteria).toEqual(["De Claude"]);
    const switched = await call("PUT", "/assistant/provider", { provider: "openai-api" });
    expect(switched).toMatchObject({ status: 200, data: { active: "openai-api" } });
    expect((await call("GET", "/assistant")).data).toMatchObject({ configured: true, provider: "openai-api", vendor: "OpenAI" });
    expect((await call("POST", "/assistant/dod", dod)).data.criteria).toEqual(["De OpenAI"]);
  });

  test("an unavailable or unknown provider is rejected", async () => {
    const call = setupBoth();
    expect((await call("PUT", "/assistant/provider", { provider: "gemini-cli" })).status).toBe(409);
    expect((await call("PUT", "/assistant/provider", { provider: "otro" })).status).toBe(400);
    expect((await call("GET", "/assistant")).data.provider).toBe("api");
  });

  test("without an assistant the list is empty", async () => {
    const call = caller(createApp(openDb(":memory:"), {}));
    expect((await call("GET", "/assistant/providers")).data).toMatchObject({ active: null, providers: [] });
  });

  test("each task can use its own model, stored across restarts, and empty goes back to the default", async () => {
    const db = openDb(":memory:");
    const mock = mockAssistant(() => JSON.stringify({ criteria: ["Uno"] }));
    const call = caller(createApp(db, { assistant: mock }));
    const listed = (await call("GET", "/assistant/providers")).data;
    expect(listed.tasks.map((x: { id: string }) => x.id)).toEqual(["stack", "dod", "skills"]);
    expect(listed.providers[0].taskDefaults).toMatchObject({ stack: mock.models.heavy, dod: mock.models.default });
    expect(listed.providers[0].suggestedModels.map((m: { id: string }) => m.id)).toContain("claude-haiku-5-5");

    const saved = await call("PUT", "/assistant/models", { provider: "api", task: "dod", model: "claude-haiku-5-5" });
    expect(saved.data.providers[0].models.tasks).toEqual({ dod: "claude-haiku-5-5" });
    await call("POST", "/assistant/dod", dod);
    expect(mock.calls.at(-1)!.model).toBe("claude-haiku-5-5");

    // A new server on the same database keeps the choice.
    const again = caller(createApp(db, { assistant: mock }));
    await again("POST", "/assistant/dod", dod);
    expect(mock.calls.at(-1)!.model).toBe("claude-haiku-5-5");

    await again("PUT", "/assistant/models", { provider: "api", task: "dod", model: "" });
    await again("POST", "/assistant/dod", dod);
    expect(mock.calls.at(-1)!.model).toBe(mock.models.default);
    expect((await again("PUT", "/assistant/models", { provider: "api", task: "dod", model: "x; rm -rf" })).status).toBe(400);
    expect((await again("PUT", "/assistant/models", { provider: "api", task: "otra", model: "x" })).status).toBe(400);
  });
});

describe("with the assistant", () => {
  test("status says configured", async () => {
    const { call } = setup(() => "{}");
    expect((await call("GET", "/assistant")).data).toEqual({ configured: true, provider: "api", label: "Claude (API key)", vendor: "Claude" });
  });

  test("stack: valid answer comes back marked as assistant", async () => {
    const { call } = setup(() =>
      JSON.stringify({ stack: ["Next.js", "TypeScript"], databases: ["PostgreSQL"], rationale: "SEO para el catálogo.", alternatives: [] }),
    );
    const { status, data } = await call("POST", "/assistant/stack", project);
    expect(status).toBe(200);
    expect(data.source).toBe("assistant");
    expect(data.recommendation.stack).toEqual(["Next.js", "TypeScript"]);
  });

  test("stack: invalid answer falls back with 200 and the default recommendation", async () => {
    const { call } = setup(() => "no es JSON");
    const { status, data } = await call("POST", "/assistant/stack", project);
    expect(status).toBe(200);
    expect(data).toEqual({ source: "default", recommendation: recommendStack(["web"]) });
  });

  test("stack: rejects a request without platforms", async () => {
    const { call } = setup(() => "{}");
    expect((await call("POST", "/assistant/stack", { ...project, platforms: [] })).status).toBe(400);
  });

  test("dod: returns criteria for a wizard draft", async () => {
    const { call } = setup(() => JSON.stringify({ criteria: ["Rechaza tarjetas vencidas", "Envía el recibo por email"] }));
    const { status, data } = await call("POST", "/assistant/dod", { project, requirement: { title: "Checkout" } });
    expect(status).toBe(200);
    expect(data.criteria).toEqual(["Rechaza tarjetas vencidas", "Envía el recibo por email"]);
  });

  test("dod: an invalid answer is a 502 without provider details", async () => {
    const { call } = setup(() => ({ status: 401 }));
    const { status, data } = await call("POST", "/assistant/dod", { project, requirement: { title: "Checkout" } });
    expect(status).toBe(502);
    expect(data.error).not.toContain("mock");
  });

  test("dod for a stored requirement uses the project context and saves nothing", async () => {
    const { call, mock } = setup((req) =>
      JSON.stringify({ criteria: req.schemaKeys.includes("criteria") ? ["Paga con tarjeta", "Muestra el total con impuestos"] : [] }),
    );
    const created = await call("POST", "/projects", {
      ...project,
      requirements: [{ title: "Checkout", description: "Pago", dod: [{ criterion: "Paga con tarjeta" }] }],
    });
    const { id } = created.data.project;
    const reqId = created.data.requirements[0].id;

    const { status, data } = await call("POST", `/projects/${id}/requirements/${reqId}/dod/suggest`);
    expect(status).toBe(200);
    expect(data.criteria).toEqual(["Muestra el total con impuestos"]);
    expect(mock!.calls[0]!.prompt).toContain("<business_rules>\n- Todo pedido requiere login");
    expect((await call("GET", `/projects/${id}`)).data.dod).toHaveLength(1);

    // Accepting one is the existing endpoint with origin llm.
    const added = await call("POST", `/projects/${id}/requirements/${reqId}/dod`, { criterion: data.criteria[0], origin: "llm" });
    expect(added.data.origin).toBe("llm");
  });

  test("dod suggest: unknown requirement is a 404", async () => {
    const { call } = setup(() => "{}");
    const created = await call("POST", "/projects", project);
    expect((await call("POST", `/projects/${created.data.project.id}/requirements/nope/dod/suggest`)).status).toBe(404);
  });

  test("skills: returns the picks; an unknown id is a 502 so the UI keeps its heuristic", async () => {
    const skills = [{ id: "user::tdd", name: "tdd", description: "Test first" }];
    const ok = setup(() => JSON.stringify({ skills: [{ id: "user::tdd", reason: "Pruebas primero" }] }));
    expect((await ok.call("POST", "/assistant/skills", { project, skills })).data).toEqual({
      skills: [{ id: "user::tdd", reason: "Pruebas primero" }],
    });
    const bad = setup(() => JSON.stringify({ skills: [{ id: "user::otra", reason: "x" }] }));
    expect((await bad.call("POST", "/assistant/skills", { project, skills })).status).toBe(502);
  });
});
